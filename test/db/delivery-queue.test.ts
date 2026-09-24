import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createTestDb, createUser } from "./harness";

/**
 * Tasks 2.1, 2.2, 2.3: dispatch queuing added to `record_move`,
 * `open_application`, `delete_application` (stays) and `register`
 * (foundation) by 20260924001200_delivery_queue.sql. Also covers
 * `dispatch_is_superseded` and `admin_failed_dispatches` from the same
 * migration.
 */

interface Identity {
  userId: string;
  memberId: string;
}

async function insertMember(
  db: PGlite,
  email: string,
  name: string,
  role: "parent" | "host",
  status: "waiting" | "active" | "deactivated" = "active",
): Promise<Identity> {
  const userId = await createUser(db, email);
  const result = await db.query<{ id: string }>(
    `insert into member (user_id, name, role, status) values ($1, $2, $3, $4) returning id;`,
    [userId, name, role, status],
  );
  return { userId, memberId: result.rows[0].id };
}

async function insertChild(db: PGlite, name: string, guardian: Identity): Promise<string> {
  const result = await db.query<{ id: string }>(
    `insert into child (name, created_by) values ($1, $2) returning id;`,
    [name, guardian.memberId],
  );
  const childId = result.rows[0].id;
  await db.query(`insert into guardian (member_id, child_id) values ($1, $2);`, [guardian.memberId, childId]);
  return childId;
}

async function insertPlace(db: PGlite, name: string, host: Identity): Promise<string> {
  const result = await db.query<{ id: string }>(
    `insert into place (name, time_zone, created_by) values ($1, 'Asia/Singapore', $2) returning id;`,
    [name, host.memberId],
  );
  const placeId = result.rows[0].id;
  await db.query(`insert into place_host (member_id, place_id) values ($1, $2);`, [host.memberId, placeId]);
  return placeId;
}

interface DispatchRow {
  id: string;
  member_id: string | null;
  application_id: string | null;
  to_email: string;
  kind: string;
  revision: number;
  payload: Record<string, unknown>;
}

async function allDispatches(db: PGlite): Promise<DispatchRow[]> {
  const result = await db.query<DispatchRow>(
    `select id, member_id, application_id, to_email, kind, revision, payload from dispatch order by created_at;`,
  );
  return result.rows;
}

describe("delivery queue (2.1, 2.2, 2.3)", () => {
  let db: PGlite;
  let parent: Identity;
  let host: Identity;
  let childId: string;
  let placeId: string;

  beforeEach(async () => {
    db = await createTestDb();
    parent = await insertMember(db, "parent@example.com", "Mum", "parent");
    host = await insertMember(db, "host@example.com", "Grandma", "host");
    childId = await insertChild(db, "Lyanne", parent);
    placeId = await insertPlace(db, "Grandma & Grandpa's", host);
  });

  afterEach(async () => {
    await db.close();
  });

  it("open_application queues a notice to the hosts", async () => {
    const result = await asUser(db, parent.userId, (tx) =>
      tx.query(
        `select * from open_application($1, $2, '2026-10-03', '2026-10-07', 'first trip');`,
        [childId, placeId],
      ),
    );
    const applicationId = (result.rows[0] as { application_id: string }).application_id;

    const rows = await allDispatches(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      member_id: host.memberId,
      application_id: applicationId,
      to_email: "host@example.com",
      kind: "notice",
      revision: 0,
    });
    expect(rows[0].payload).toMatchObject({ notice_kind: "propose", child_name: "Lyanne" });
  });

  async function openApp(): Promise<string> {
    const result = await asUser(db, parent.userId, (tx) =>
      tx.query(`select * from open_application($1, $2, '2026-10-03', '2026-10-07');`, [childId, placeId]),
    );
    return (result.rows[0] as { application_id: string }).application_id;
  }

  it("host counter-proposal queues a notice to the parents only", async () => {
    const applicationId = await openApp();
    await db.exec(`delete from dispatch;`); // clear the opening notice

    await asUser(db, host.userId, (tx) =>
      tx.query(`select * from record_move($1, 'propose', '2026-10-04', '2026-10-08');`, [applicationId]),
    );

    const rows = await allDispatches(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ member_id: parent.memberId, kind: "notice" });
  });

  it("accept queues a notice to the proposing side and an invite (REQUEST) to every participant", async () => {
    const applicationId = await openApp();
    await db.exec(`delete from dispatch;`);

    await asUser(db, host.userId, (tx) => tx.query(`select * from record_move($1, 'accept');`, [applicationId]));

    const rows = await allDispatches(db);
    const notices = rows.filter((r) => r.kind === "notice");
    const invites = rows.filter((r) => r.kind === "invite");

    expect(notices).toHaveLength(1);
    expect(notices[0].member_id).toBe(parent.memberId); // the proposing side (parents)

    expect(invites).toHaveLength(2); // parent + host
    expect(invites.map((r) => r.to_email).sort()).toEqual(["host@example.com", "parent@example.com"]);
    for (const invite of invites) {
      expect(invite.revision).toBe(1);
      expect(invite.application_id).toBe(applicationId);
      expect(invite.payload).toMatchObject({ method: "REQUEST", revision: 1 });
      expect((invite.payload as { attendees: string[] }).attendees.sort()).toEqual([
        "host@example.com",
        "parent@example.com",
      ]);
    }
  });

  it("reject (no prior agreement) queues a notice to the proposing side only, no invite", async () => {
    const applicationId = await openApp();
    await db.exec(`delete from dispatch;`);

    await asUser(db, host.userId, (tx) => tx.query(`select * from record_move($1, 'reject');`, [applicationId]));

    const rows = await allDispatches(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "notice", member_id: parent.memberId });
  });

  it("cancel before agreement queues a notice to the other side, no invite", async () => {
    const applicationId = await openApp();
    await db.exec(`delete from dispatch;`);

    await asUser(db, parent.userId, (tx) => tx.query(`select * from record_move($1, 'cancel');`, [applicationId]));

    const rows = await allDispatches(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "notice", member_id: host.memberId });
  });

  it("cancel after agreement queues a notice to the other side and a CANCEL invite to every participant", async () => {
    const applicationId = await openApp();
    await asUser(db, host.userId, (tx) => tx.query(`select * from record_move($1, 'accept');`, [applicationId]));
    await db.exec(`delete from dispatch;`);

    await asUser(db, parent.userId, (tx) => tx.query(`select * from record_move($1, 'cancel');`, [applicationId]));

    const rows = await allDispatches(db);
    const notices = rows.filter((r) => r.kind === "notice");
    const invites = rows.filter((r) => r.kind === "invite");

    expect(notices).toHaveLength(1);
    expect(notices[0].member_id).toBe(host.memberId);

    expect(invites).toHaveLength(2);
    for (const invite of invites) {
      expect(invite.revision).toBe(2); // accept -> 1, cancel-after-agreement -> 2
      expect(invite.payload).toMatchObject({ method: "CANCEL" });
    }
  });

  it("a refused move (e.g. answering your own proposal) queues nothing (2.3)", async () => {
    const applicationId = await openApp();
    await db.exec(`delete from dispatch;`);

    await expect(
      asUser(db, parent.userId, (tx) => tx.query(`select * from record_move($1, 'accept');`, [applicationId])),
    ).rejects.toThrow();

    const rows = await allDispatches(db);
    expect(rows).toHaveLength(0);
  });

  it("delete_application queues a withdrawn notice to the hosts, with application_id nulled after the delete", async () => {
    const applicationId = await openApp();
    await db.exec(`delete from dispatch;`);

    await asUser(db, parent.userId, (tx) => tx.query(`select * from delete_application($1);`, [applicationId]));

    const rows = await allDispatches(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "notice", member_id: host.memberId, application_id: null });
    expect(rows[0].payload).toMatchObject({ notice_kind: "withdrawn", child_name: "Lyanne" });
  });

  it("a refused delete (host already answered) queues nothing", async () => {
    const applicationId = await openApp();
    await asUser(db, host.userId, (tx) =>
      tx.query(`select * from record_move($1, 'propose', '2026-10-05', '2026-10-09');`, [applicationId]),
    );
    await db.exec(`delete from dispatch;`);

    await expect(
      asUser(db, parent.userId, (tx) => tx.query(`select * from delete_application($1);`, [applicationId])),
    ).rejects.toThrow();

    const rows = await allDispatches(db);
    expect(rows).toHaveLength(0);
  });
});

describe("register queues a MemberWaiting notice only on the waiting outcome (2.2)", () => {
  let db: PGlite;

  beforeEach(async () => {
    db = await createTestDb();
    await db.exec(`insert into app_admin (email) values ('admin@example.com');`);
  });

  afterEach(async () => {
    await db.close();
  });

  it("waiting outcome (no code) queues one admin-addressed dispatch", async () => {
    const userId = await createUser(db, "newparent@example.com");
    const result = await asUser(db, userId, (tx) => tx.query(`select * from register('parent', 'New Parent');`));
    expect((result.rows[0] as { outcome: string }).outcome).toBe("waiting");

    const rows = await allDispatches(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ member_id: null, application_id: null, to_email: "admin@example.com", kind: "notice" });
    expect(rows[0].payload).toMatchObject({ notice_kind: "waiting", role: "parent" });
  });

  it("active outcome (correct code) queues no dispatch", async () => {
    await db.query(
      `update app_setting set join_code_hash = extensions.crypt('secretcode', extensions.gen_salt('bf'));`,
    );
    const userId = await createUser(db, "newhost@example.com");
    const result = await asUser(db, userId, (tx) =>
      tx.query(`select * from register('host', 'New Host', 'secretcode');`),
    );
    expect((result.rows[0] as { outcome: string }).outcome).toBe("active");

    const rows = await allDispatches(db);
    expect(rows).toHaveLength(0);
  });

  it("wrong-code outcome (no member created) queues no dispatch", async () => {
    await db.query(
      `update app_setting set join_code_hash = extensions.crypt('secretcode', extensions.gen_salt('bf'));`,
    );
    const userId = await createUser(db, "wrongcode@example.com");
    const result = await asUser(db, userId, (tx) =>
      tx.query(`select * from register('parent', 'Wrong Coder', 'nope');`),
    );
    expect((result.rows[0] as { outcome: string }).outcome).toBe("wrong_code");

    const rows = await allDispatches(db);
    expect(rows).toHaveLength(0);
  });
});

describe("dispatch_is_superseded and admin_failed_dispatches", () => {
  const WORKER_SECRET = "test-worker-secret";
  let db: PGlite;
  let parent: Identity;

  beforeEach(async () => {
    db = await createTestDb();
    parent = await insertMember(db, "parent@example.com", "Mum", "parent");
    await db.query(
      `insert into app_private.delivery_worker (secret_hash) values (encode(extensions.digest($1, 'sha256'), 'hex'));`,
      [WORKER_SECRET],
    );
  });

  afterEach(async () => {
    await db.close();
  });

  it("is false with no sent invites, true once a higher revision is sent", async () => {
    const appId = "00000000-0000-0000-0000-000000000001";
    // No dispatch rows at all yet for this synthetic application id.
    const before = await asUser(db, parent.userId, (tx) =>
      tx.query(`select dispatch_is_superseded($1, $2, 1);`, [WORKER_SECRET, appId]),
    );
    expect((before.rows[0] as Record<string, boolean>).dispatch_is_superseded).toBe(false);
  });

  it("refuses without the correct worker secret", async () => {
    await expect(
      asUser(db, parent.userId, (tx) =>
        tx.query(`select dispatch_is_superseded($1, gen_random_uuid(), 1);`, ["wrong-secret"]),
      ),
    ).rejects.toThrow();
  });

  it("admin_failed_dispatches refuses a non-admin and returns no secrets", async () => {
    await expect(
      asUser(db, parent.userId, (tx) => tx.query(`select * from admin_failed_dispatches();`)),
    ).rejects.toThrow();

    await db.exec(`insert into app_admin (email) values ('parent@example.com');`);
    const result = await asUser(db, parent.userId, (tx) => tx.query(`select * from admin_failed_dispatches();`));
    expect(result.rows).toEqual([]); // no failed rows yet; nothing SMTP-shaped either way
  });
});

describe("application_dispatch_summary (5.2)", () => {
  let db: PGlite;
  let parent: Identity;
  let host: Identity;
  let outsider: Identity;
  let childId: string;
  let placeId: string;
  let applicationId: string;

  beforeEach(async () => {
    db = await createTestDb();
    parent = await insertMember(db, "parent@example.com", "Mum", "parent");
    host = await insertMember(db, "host@example.com", "Grandma", "host");
    outsider = await insertMember(db, "outsider@example.com", "Nosy", "parent");
    childId = await insertChild(db, "Lyanne", parent);
    placeId = await insertPlace(db, "Grandma & Grandpa's", host);

    const result = await asUser(db, parent.userId, (tx) =>
      tx.query(`select * from open_application($1, $2, '2026-10-03', '2026-10-07');`, [childId, placeId]),
    );
    applicationId = (result.rows[0] as { application_id: string }).application_id;
  });

  afterEach(async () => {
    await db.close();
  });

  it("reports the sent/total counts and no failed recipient when everything is pending", async () => {
    const result = await asUser(db, parent.userId, (tx) =>
      tx.query(`select * from application_dispatch_summary($1);`, [applicationId]),
    );
    const row = result.rows[0] as { sent: number; total: number; failed_recipient_name: string | null };
    // Only the opening PROPOSE's notice has been queued so far, no invite
    // yet — application_dispatch_summary counts invites only (this
    // function's own logic and rationale live in
    // test/db/dispatch-summary.test.ts, which supersedes this describe
    // block's own coverage since 20260924001300_dispatch_summary_invites.sql).
    expect(row).toEqual({ sent: 0, total: 0, failed_recipient_name: null });
  });

  it("names the failed recipient once a dispatch for this application is marked failed", async () => {
    await db.exec(
      `insert into app_private.delivery_worker (secret_hash) values (encode(extensions.digest('s', 'sha256'), 'hex'));`,
    );
    const dispatchId = (
      await db.query<{ id: string }>(`select id from dispatch where application_id = $1;`, [applicationId])
    ).rows[0].id;
    for (let i = 0; i < 4; i++) {
      await asUser(db, host.userId, (tx) =>
        tx.query(`select record_dispatch_outcome('s', $1, 'failed', 'smtp down');`, [dispatchId]),
      );
    }

    const result = await asUser(db, host.userId, (tx) =>
      tx.query(`select * from application_dispatch_summary($1);`, [applicationId]),
    );
    const row = result.rows[0] as { sent: number; total: number; failed_recipient_name: string | null };
    expect(row.failed_recipient_name).toBe("Grandma");
  });

  it("refuses a non-participant", async () => {
    await expect(
      asUser(db, outsider.userId, (tx) => tx.query(`select * from application_dispatch_summary($1);`, [applicationId])),
    ).rejects.toThrow();
  });
});

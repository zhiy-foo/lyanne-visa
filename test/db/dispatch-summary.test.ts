import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createTestDb, createUser } from "./harness";

/**
 * public.application_dispatch_summary, replaced by
 * 20260924001300_dispatch_summary_invites.sql to count only `kind = 'invite'`
 * rows (not notices) and only the application's latest invite revision — the
 * UI's "Calendar invite(s) sent to N of M people" line
 * (ApplicationDetail.tsx) must never be inflated by notice dispatches or by
 * a superseded revision's rows after a date change and re-accept.
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
): Promise<Identity> {
  const userId = await createUser(db, email);
  const result = await db.query<{ id: string }>(
    `insert into member (user_id, name, role, status) values ($1, $2, $3, 'active') returning id;`,
    [userId, name, role],
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

type SummaryRow = { sent: number; total: number; failed_recipient_name: string | null };

async function summary(db: PGlite, caller: Identity, applicationId: string): Promise<SummaryRow> {
  const result = await asUser(db, caller.userId, (tx) =>
    tx.query(`select * from application_dispatch_summary($1);`, [applicationId]),
  );
  return result.rows[0] as SummaryRow;
}

async function markSent(
  db: PGlite,
  caller: Identity,
  workerSecret: string,
  applicationId: string,
  kind: "notice" | "invite",
) {
  const rows = (
    await db.query<{ id: string }>(`select id from dispatch where application_id = $1 and kind = $2;`, [
      applicationId,
      kind,
    ])
  ).rows;
  for (const row of rows) {
    await asUser(db, caller.userId, (tx) =>
      tx.query(`select record_dispatch_outcome($1, $2, 'sent');`, [workerSecret, row.id]),
    );
  }
}

describe("application_dispatch_summary counts only invites, latest revision only", () => {
  const WORKER_SECRET = "test-worker-secret";
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
    await db.query(
      `insert into app_private.delivery_worker (secret_hash) values (encode(extensions.digest($1, 'sha256'), 'hex'));`,
      [WORKER_SECRET],
    );

    const result = await asUser(db, parent.userId, (tx) =>
      tx.query(`select * from open_application($1, $2, '2026-10-03', '2026-10-07');`, [childId, placeId]),
    );
    applicationId = (result.rows[0] as { application_id: string }).application_id;
  });

  afterEach(async () => {
    await db.close();
  });

  it("a negotiating application (only a notice queued so far) reports total 0", async () => {
    const row = await summary(db, parent, applicationId);
    expect(row).toEqual({ sent: 0, total: 0, failed_recipient_name: null });
  });

  it("after accept, invites are counted per participant (not the notice)", async () => {
    await asUser(db, host.userId, (tx) => tx.query(`select * from record_move($1, 'accept');`, [applicationId]));

    const before = await summary(db, parent, applicationId);
    expect(before).toEqual({ sent: 0, total: 2, failed_recipient_name: null });

    await markSent(db, host, WORKER_SECRET, applicationId, "invite");

    const after = await summary(db, host, applicationId);
    expect(after).toEqual({ sent: 2, total: 2, failed_recipient_name: null });
  });

  it("after a date change and re-accept, counts reflect only the latest invite revision", async () => {
    await asUser(db, host.userId, (tx) => tx.query(`select * from record_move($1, 'accept');`, [applicationId]));
    await markSent(db, host, WORKER_SECRET, applicationId, "invite"); // revision 1: 2/2 sent

    await asUser(db, parent.userId, (tx) =>
      tx.query(`select * from record_move($1, 'propose', '2026-10-10', '2026-10-14');`, [applicationId]),
    );
    await asUser(db, host.userId, (tx) => tx.query(`select * from record_move($1, 'accept');`, [applicationId]));
    // revision 2's fresh invite rows are left pending (not marked sent).

    const row = await summary(db, parent, applicationId);
    expect(row).toEqual({ sent: 0, total: 2, failed_recipient_name: null });
  });

  it("keeps surfacing a failed recipient even though a failed notice no longer counts toward total", async () => {
    // Fail the opening notice to the host (4 attempts -> terminal 'failed').
    const noticeId = (
      await db.query<{ id: string }>(`select id from dispatch where application_id = $1 and kind = 'notice';`, [
        applicationId,
      ])
    ).rows[0].id;
    for (let i = 0; i < 4; i++) {
      await asUser(db, host.userId, (tx) =>
        tx.query(`select record_dispatch_outcome($1, $2, 'failed', 'smtp down');`, [WORKER_SECRET, noticeId]),
      );
    }

    const row = await summary(db, parent, applicationId);
    expect(row).toEqual({ sent: 0, total: 0, failed_recipient_name: "Grandma" });
  });

  it("refuses a caller with no side on the application", async () => {
    await expect(
      asUser(db, outsider.userId, (tx) => tx.query(`select * from application_dispatch_summary($1);`, [applicationId])),
    ).rejects.toThrow();
  });
});

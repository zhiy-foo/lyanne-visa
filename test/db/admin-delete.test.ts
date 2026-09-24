import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asAnon, asUser, createTestDb, createUser } from "./harness";

interface RegisterRow {
  outcome: string;
  member_id: string | null;
  attempts_left: number;
}

/** Inserts a member row directly (as the superuser) — mirrors
 * functions.test.ts's insertMember, used here to set up deactivated
 * accounts and links without going through register()/deactivate_member()
 * every time. */
async function insertMember(
  db: PGlite,
  userId: string,
  name: string,
  role: "parent" | "host",
  status: "waiting" | "active" | "deactivated",
): Promise<string> {
  const result = await db.query<{ id: string }>(
    `insert into member (user_id, name, role, status) values ($1, $2, $3, $4) returning id;`,
    [userId, name, role, status],
  );
  return result.rows[0].id;
}

async function register(
  db: PGlite,
  userId: string,
  role: string,
  name: string,
  code: string | null = null,
): Promise<RegisterRow> {
  const result = await asUser(db, userId, (tx) =>
    tx.query<RegisterRow>(`select * from register($1, $2, $3);`, [role, name, code]),
  );
  return result.rows[0];
}

describe("admin_delete_member / admin_deletable_member_ids", () => {
  let db: PGlite;
  let adminUserId: string;

  beforeEach(async () => {
    db = await createTestDb();
    adminUserId = await createUser(db, "admin@example.com");
    await db.query(`insert into app_admin (email) values ($1);`, ["admin@example.com"]);
  });

  afterEach(async () => {
    await db.close();
  });

  it("deletes a deactivated, never-linked member; the auth identity can register again (lands waiting, no code)", async () => {
    const userId = await createUser(db, "gone@example.com");
    const memberId = await insertMember(db, userId, "Gone", "parent", "deactivated");

    await asUser(db, adminUserId, (tx) => tx.query(`select admin_delete_member($1);`, [memberId]));

    const row = await db.query(`select 1 from member where id = $1;`, [memberId]);
    expect(row.rows).toHaveLength(0);

    const attempt = await db.query(`select 1 from join_attempt where user_id = $1;`, [userId]);
    expect(attempt.rows).toHaveLength(0);

    const outcome = await register(db, userId, "parent", "Gone Again", null);
    expect(outcome.outcome).toBe("waiting");
    expect(outcome.member_id).not.toBeNull();
  });

  it("also deletes the deleted user's join_attempt row when one exists", async () => {
    const userId = await createUser(db, "hadattempts@example.com");
    const memberId = await insertMember(db, userId, "HadAttempts", "host", "deactivated");
    await db.query(`insert into join_attempt (user_id, wrong_count) values ($1, 3);`, [userId]);

    await asUser(db, adminUserId, (tx) => tx.query(`select admin_delete_member($1);`, [memberId]));

    const attempt = await db.query(`select 1 from join_attempt where user_id = $1;`, [userId]);
    expect(attempt.rows).toHaveLength(0);
  });

  it("refuses an active member (not_deletable)", async () => {
    const userId = await createUser(db, "active@example.com");
    const memberId = await insertMember(db, userId, "Active", "parent", "active");

    await expect(
      asUser(db, adminUserId, (tx) => tx.query(`select admin_delete_member($1);`, [memberId])),
    ).rejects.toThrow("not_deletable");
  });

  it("refuses a waiting member (not_deletable)", async () => {
    const userId = await createUser(db, "waiting@example.com");
    const memberId = await insertMember(db, userId, "Waiting", "host", "waiting");

    await expect(
      asUser(db, adminUserId, (tx) => tx.query(`select admin_delete_member($1);`, [memberId])),
    ).rejects.toThrow("not_deletable");
  });

  it("refuses a deactivated member who created a child (not_deletable)", async () => {
    const userId = await createUser(db, "createdchild@example.com");
    const memberId = await insertMember(db, userId, "CreatedChild", "parent", "active");
    const child = await db.query<{ id: string }>(
      `insert into child (name, created_by) values ('Kid', $1) returning id;`,
      [memberId],
    );
    // Remove the guardian link (kept minimal) but leave created_by pointing
    // at this member — deactivate afterwards so the guardian-link path isn't
    // what's being tested here.
    await db.query(`delete from guardian where member_id = $1 and child_id = $2;`, [
      memberId,
      child.rows[0].id,
    ]);
    await db.query(`update member set status = 'deactivated' where id = $1;`, [memberId]);

    await expect(
      asUser(db, adminUserId, (tx) => tx.query(`select admin_delete_member($1);`, [memberId])),
    ).rejects.toThrow("not_deletable");
  });

  it("refuses a deactivated member who created a place (not_deletable)", async () => {
    const userId = await createUser(db, "createdplace@example.com");
    const memberId = await insertMember(db, userId, "CreatedPlace", "host", "active");
    const place = await db.query<{ id: string }>(
      `insert into place (name, time_zone, created_by) values ('Home', 'Asia/Singapore', $1) returning id;`,
      [memberId],
    );
    await db.query(`delete from place_host where member_id = $1 and place_id = $2;`, [
      memberId,
      place.rows[0].id,
    ]);
    await db.query(`update member set status = 'deactivated' where id = $1;`, [memberId]);

    await expect(
      asUser(db, adminUserId, (tx) => tx.query(`select admin_delete_member($1);`, [memberId])),
    ).rejects.toThrow("not_deletable");
  });

  it("refuses a deactivated member who is a guardian of a child (not_deletable)", async () => {
    const creatorUserId = await createUser(db, "creator@example.com");
    const creatorId = await insertMember(db, creatorUserId, "Creator", "parent", "active");
    const child = await db.query<{ id: string }>(
      `insert into child (name, created_by) values ('Kid', $1) returning id;`,
      [creatorId],
    );

    const userId = await createUser(db, "coguardian@example.com");
    const memberId = await insertMember(db, userId, "CoGuardian", "parent", "deactivated");
    await db.query(`insert into guardian (member_id, child_id) values ($1, $2);`, [
      memberId,
      child.rows[0].id,
    ]);

    await expect(
      asUser(db, adminUserId, (tx) => tx.query(`select admin_delete_member($1);`, [memberId])),
    ).rejects.toThrow("not_deletable");
  });

  it("refuses a deactivated member who is a host of a place (not_deletable)", async () => {
    const creatorUserId = await createUser(db, "placecreator@example.com");
    const creatorId = await insertMember(db, creatorUserId, "PlaceCreator", "host", "active");
    const place = await db.query<{ id: string }>(
      `insert into place (name, time_zone, created_by) values ('Home', 'Asia/Singapore', $1) returning id;`,
      [creatorId],
    );

    const userId = await createUser(db, "cohost@example.com");
    const memberId = await insertMember(db, userId, "CoHost", "host", "deactivated");
    await db.query(`insert into place_host (member_id, place_id) values ($1, $2);`, [
      memberId,
      place.rows[0].id,
    ]);

    await expect(
      asUser(db, adminUserId, (tx) => tx.query(`select admin_delete_member($1);`, [memberId])),
    ).rejects.toThrow("not_deletable");
  });

  it("refuses a non-existent member (not_found)", async () => {
    const dummyId = "00000000-0000-0000-0000-000000000000";
    await expect(
      asUser(db, adminUserId, (tx) => tx.query(`select admin_delete_member($1);`, [dummyId])),
    ).rejects.toThrow("not_found");
  });

  it("refuses a non-admin caller (not_admin)", async () => {
    const nonAdminUserId = await createUser(db, "notadmin@example.com");
    await insertMember(db, nonAdminUserId, "NotAdmin", "parent", "active");

    const userId = await createUser(db, "target@example.com");
    const memberId = await insertMember(db, userId, "Target", "parent", "deactivated");

    await expect(
      asUser(db, nonAdminUserId, (tx) => tx.query(`select admin_delete_member($1);`, [memberId])),
    ).rejects.toThrow("not_admin");
    await expect(
      asUser(db, nonAdminUserId, (tx) => tx.query(`select * from admin_deletable_member_ids();`)),
    ).rejects.toThrow("not_admin");
  });

  it("refuses an anonymous (signed-out) caller", async () => {
    const dummyId = "00000000-0000-0000-0000-000000000000";
    await expect(asAnon(db, (tx) => tx.query(`select admin_delete_member($1);`, [dummyId]))).rejects.toThrow();
    await expect(asAnon(db, (tx) => tx.query(`select * from admin_deletable_member_ids();`))).rejects.toThrow();
  });

  it("admin_deletable_member_ids lists exactly the deletable accounts", async () => {
    const deletableUserId = await createUser(db, "deletable@example.com");
    const deletableId = await insertMember(db, deletableUserId, "Deletable", "parent", "deactivated");

    const activeUserId = await createUser(db, "activeone@example.com");
    await insertMember(db, activeUserId, "Active", "parent", "active");

    const waitingUserId = await createUser(db, "waitingone@example.com");
    await insertMember(db, waitingUserId, "Waiting", "host", "waiting");

    const linkedUserId = await createUser(db, "linked@example.com");
    const linkedId = await insertMember(db, linkedUserId, "Linked", "host", "active");
    const place = await db.query<{ id: string }>(
      `insert into place (name, time_zone, created_by) values ('Home', 'Asia/Singapore', $1) returning id;`,
      [linkedId],
    );
    await db.query(`update member set status = 'deactivated' where id = $1;`, [linkedId]);

    const result = await asUser(db, adminUserId, (tx) =>
      tx.query<{ admin_deletable_member_ids: string }>(`select * from admin_deletable_member_ids();`),
    );
    const ids = result.rows.map((r) => r.admin_deletable_member_ids);

    expect(ids).toContain(deletableId);
    expect(ids).not.toContain(linkedId);
    expect(ids).toHaveLength(1);
    void place;
  });
});

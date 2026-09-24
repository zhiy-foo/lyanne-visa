import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, createUser } from "./harness";

/**
 * Task 1.1: `application`/`move` schema constraints, and `place.capacity`.
 *
 * Task 1.2 note (orchestrator correction — tasks.md left unticked): design.md
 * and tasks.md originally called for a tstzrange/date-range exclusion
 * constraint on agreed ranges per child, verified by a PGlite test with two
 * concurrent `accept` calls racing on overlapping dates. That constraint was
 * NOT added (see 20260924000700_stays_schema.sql's comment: `agreed?` is
 * deduced, never stored, so there is no column to index) and no such test
 * exists here or in stays-functions.test.ts. PGlite serves exactly one
 * connection, so two calls can never actually run concurrently against it —
 * a `for update` lock and a second connection racing against it cannot be
 * expressed as a PGlite test at all, "passing" or not. Concurrency safety
 * for rule 6 (no double-booking) and capacity comes from `record_move`
 * locking the child/place rows with `select ... for update` before checking
 * (see 20260924000900_stays_functions.sql); that this actually serializes
 * concurrent callers is verified on hosted Supabase, not here.
 */
describe("stays schema (application, move, place.capacity)", () => {
  let db: PGlite;
  let memberId: string;
  let childId: string;
  let placeId: string;

  beforeEach(async () => {
    db = await createTestDb();
    const userId = await createUser(db, "p1@example.com");
    const member = await db.query<{ id: string }>(
      `insert into member (user_id, name, role, status) values ($1, 'P1', 'parent', 'active') returning id;`,
      [userId],
    );
    memberId = member.rows[0].id;
    const child = await db.query<{ id: string }>(
      `insert into child (name, created_by) values ('C1', $1) returning id;`,
      [memberId],
    );
    childId = child.rows[0].id;
    const place = await db.query<{ id: string }>(
      `insert into place (name, time_zone, created_by) values ('Home', 'Asia/Singapore', $1) returning id;`,
      [memberId],
    );
    placeId = place.rows[0].id;
  });

  afterEach(async () => {
    await db.close();
  });

  async function insertApplication(): Promise<string> {
    const result = await db.query<{ id: string }>(
      `insert into application (child_id, place_id, created_by) values ($1, $2, $3) returning id;`,
      [childId, placeId, memberId],
    );
    return result.rows[0].id;
  }

  it("a propose move requires both dates", async () => {
    const appId = await insertApplication();
    await expect(
      db.query(
        `insert into move (application_id, kind, side, by, date_start) values ($1, 'propose', 'parent', $2, '2026-10-03');`,
        [appId, memberId],
      ),
    ).rejects.toThrow();
  });

  it("a non-propose move must not carry dates", async () => {
    const appId = await insertApplication();
    await expect(
      db.query(
        `insert into move (application_id, kind, side, by, date_start, date_end)
         values ($1, 'accept', 'host', $2, '2026-10-03', '2026-10-06');`,
        [appId, memberId],
      ),
    ).rejects.toThrow();
  });

  it("a propose move with pick-up on or before drop-off is refused", async () => {
    const appId = await insertApplication();
    await expect(
      db.query(
        `insert into move (application_id, kind, side, by, date_start, date_end)
         values ($1, 'propose', 'parent', $2, '2026-10-06', '2026-10-03');`,
        [appId, memberId],
      ),
    ).rejects.toThrow();
  });

  it("a valid propose move inserts cleanly", async () => {
    const appId = await insertApplication();
    const result = await db.query<{ id: string }>(
      `insert into move (application_id, kind, side, by, date_start, date_end)
       values ($1, 'propose', 'parent', $2, '2026-10-03', '2026-10-06') returning id;`,
      [appId, memberId],
    );
    expect(result.rows).toHaveLength(1);
  });

  it("an unknown move kind is refused", async () => {
    const appId = await insertApplication();
    await expect(
      db.query(`insert into move (application_id, kind, side, by) values ($1, 'nope', 'parent', $2);`, [
        appId,
        memberId,
      ]),
    ).rejects.toThrow();
  });

  it("place.capacity accepts null (unlimited) and positive integers, refuses zero and negative", async () => {
    await db.query(`update place set capacity = null where id = $1;`, [placeId]);
    await db.query(`update place set capacity = 3 where id = $1;`, [placeId]);
    await expect(db.query(`update place set capacity = 0 where id = $1;`, [placeId])).rejects.toThrow();
    await expect(db.query(`update place set capacity = -1 where id = $1;`, [placeId])).rejects.toThrow();
  });

  it("migrations apply cleanly and the shape matches design Decision 1", async () => {
    const columns = await db.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_name = 'move' order by column_name;`,
    );
    const names = columns.rows.map((r) => r.column_name);
    expect(names).toEqual(
      expect.arrayContaining([
        "application_id",
        "at",
        "by",
        "date_end",
        "date_start",
        "id",
        "kind",
        "note",
        "seq",
        "side",
      ]),
    );
  });
});

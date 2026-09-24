import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createTestDb, createUser } from "./harness";

/** PGlite (like node-postgres) parses `date` columns into JS `Date` objects,
 * not strings — normalize to `YYYY-MM-DD` before comparing/keying on them. */
function isoDate(value: string | Date | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

/**
 * Tasks 2.1-2.5: `fold_application`, `record_move`, `open_application`,
 * `place_capacity_status`, `delete_application`.
 *
 * Note on concurrency (task 1.2, orchestrator correction): the overlap and
 * capacity checks inside `record_move` take `select ... for update` locks on
 * the child/place rows before counting, mirroring foundation's last-parent/
 * last-host pattern. PGlite serves exactly one connection, so a genuine
 * concurrent "two proposals racing to accept" race cannot be exercised here
 * — that guarantee is verified on hosted Supabase, not in this file. The
 * tests below exercise the *sequential* refusal paths (overlap, capacity)
 * that the same locked section produces.
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

async function insertPlace(
  db: PGlite,
  name: string,
  host: Identity,
  capacity: number | null = null,
): Promise<string> {
  const result = await db.query<{ id: string }>(
    `insert into place (name, time_zone, created_by, capacity) values ($1, 'Asia/Singapore', $2, $3) returning id;`,
    [name, host.memberId, capacity],
  );
  const placeId = result.rows[0].id;
  await db.query(`insert into place_host (member_id, place_id) values ($1, $2);`, [host.memberId, placeId]);
  return placeId;
}

interface RecordMoveRow {
  move_id: string;
  application_id: string;
  child_id: string;
  place_id: string;
  kind: string;
  side: string;
  by: string;
  at: string;
  date_start: string | null;
  date_end: string | null;
  note: string | null;
  status_before: string;
  status_after: string;
}

interface OpenApplicationRow {
  application_id: string;
  move_id: string;
  child_id: string;
  place_id: string;
  kind: string;
  side: string;
  by: string;
  at: string;
  date_start: string | null;
  date_end: string | null;
  note: string | null;
  status_after: string;
}

async function openApplication(
  db: PGlite,
  userId: string,
  child: string,
  place: string,
  start: string,
  end: string,
  note: string | null = null,
): Promise<OpenApplicationRow> {
  const result = await asUser(db, userId, (tx) =>
    tx.query<OpenApplicationRow>(`select * from open_application($1, $2, $3, $4, $5);`, [
      child,
      place,
      start,
      end,
      note,
    ]),
  );
  return result.rows[0];
}

async function recordMove(
  db: PGlite,
  userId: string,
  application: string,
  kind: string,
  start: string | null = null,
  end: string | null = null,
  note: string | null = null,
): Promise<RecordMoveRow> {
  const result = await asUser(db, userId, (tx) =>
    tx.query<RecordMoveRow>(`select * from record_move($1, $2, $3, $4, $5);`, [application, kind, start, end, note]),
  );
  return result.rows[0];
}

async function fold(db: PGlite, application: string) {
  const result = await db.query<{
    status: string;
    awaiting: string | null;
    agreed_start: string | null;
    agreed_end: string | null;
    open_start: string | null;
    open_end: string | null;
    open_side: string | null;
    revision: number;
  }>(`select * from app_private.fold_application($1);`, [application]);
  return result.rows[0];
}

describe("stays functions (fold_application, record_move, open_application, place_capacity_status, delete_application)", () => {
  let db: PGlite;
  let admin: Identity;
  let parent: Identity;
  let parent2: Identity;
  let host: Identity;
  let host2: Identity;
  let uninvolvedParent: Identity;
  let childId: string;
  let placeId: string;

  beforeEach(async () => {
    db = await createTestDb();
    const adminUserId = await createUser(db, "admin@example.com");
    await db.query(`insert into app_admin (email) values ('admin@example.com');`);
    admin = { userId: adminUserId, memberId: "" }; // admin has no member row by design

    parent = await insertMember(db, "parent@example.com", "Parent", "parent");
    parent2 = await insertMember(db, "parent2@example.com", "Parent2", "parent");
    host = await insertMember(db, "host@example.com", "Host", "host");
    host2 = await insertMember(db, "host2@example.com", "Host2", "host");
    uninvolvedParent = await insertMember(db, "stranger-parent@example.com", "Stranger", "parent");

    childId = await insertChild(db, "Lyanne", parent);
    placeId = await insertPlace(db, "Grandma's", host);
  });

  afterEach(async () => {
    await db.close();
  });

  // -- open_application (task 2.3) -----------------------------------------

  describe("open_application", () => {
    it("an active parent guardian opens an application with a first propose move", async () => {
      const row = await openApplication(db, parent.userId, childId, placeId, "2026-10-03", "2026-10-06");
      expect(row.kind).toBe("propose");
      expect(row.side).toBe("parent");
      expect(row.status_after).toBe("negotiating");
      expect(isoDate(row.date_start)).toBe("2026-10-03");
      expect(isoDate(row.date_end)).toBe("2026-10-06");

      const f = await fold(db, row.application_id);
      expect(f.status).toBe("negotiating");
      expect(f.awaiting).toBe("host");
      expect(isoDate(f.open_start)).toBe("2026-10-03");
      expect(isoDate(f.open_end)).toBe("2026-10-06");
      expect(f.agreed_start).toBeNull();
    });

    it("a host cannot open an application", async () => {
      await expect(
        openApplication(db, host.userId, childId, placeId, "2026-10-03", "2026-10-06"),
      ).rejects.toThrow("not_parent");
    });

    it("a parent who is not this child's guardian is refused", async () => {
      await expect(
        openApplication(db, uninvolvedParent.userId, childId, placeId, "2026-10-03", "2026-10-06"),
      ).rejects.toThrow("not_guardian_of_child");
    });

    it("a pick-up day on or before the drop-off day is refused and creates nothing", async () => {
      await expect(
        openApplication(db, parent.userId, childId, placeId, "2026-10-06", "2026-10-03"),
      ).rejects.toThrow("invalid_dates");

      const count = await db.query<{ n: string }>(`select count(*)::int as n from application;`);
      expect(Number(count.rows[0].n)).toBe(0);
    });
  });

  // -- fold_application: every row of the §5 state table (task 2.1) -------

  describe("fold_application state table", () => {
    it("propose (parent) -> negotiating, awaiting host", async () => {
      const opened = await openApplication(db, parent.userId, childId, placeId, "2026-10-03", "2026-10-06");
      const f = await fold(db, opened.application_id);
      expect(f.status).toBe("negotiating");
      expect(f.awaiting).toBe("host");
      expect(f.agreed_start).toBeNull();
    });

    it("accept -> confirmed, agreed dates set, revision 1", async () => {
      const opened = await openApplication(db, parent.userId, childId, placeId, "2026-10-03", "2026-10-06");
      await recordMove(db, host.userId, opened.application_id, "accept");

      const f = await fold(db, opened.application_id);
      expect(f.status).toBe("confirmed");
      expect(f.awaiting).toBeNull();
      expect(isoDate(f.agreed_start)).toBe("2026-10-03");
      expect(isoDate(f.agreed_end)).toBe("2026-10-06");
      expect(f.revision).toBe(1);
    });

    it("propose-after-agreement -> confirmed (unchanged) + awaiting the other side on the new dates", async () => {
      const opened = await openApplication(db, parent.userId, childId, placeId, "2026-10-03", "2026-10-06");
      await recordMove(db, host.userId, opened.application_id, "accept");
      await recordMove(db, host.userId, opened.application_id, "propose", "2026-10-04", "2026-10-07");

      const f = await fold(db, opened.application_id);
      expect(f.status).toBe("confirmed");
      expect(isoDate(f.agreed_start)).toBe("2026-10-03");
      expect(isoDate(f.agreed_end)).toBe("2026-10-06");
      expect(isoDate(f.open_start)).toBe("2026-10-04");
      expect(isoDate(f.open_end)).toBe("2026-10-07");
      expect(f.awaiting).toBe("parent");
    });

    it("reject with an existing agreement -> confirmed, agreed unchanged, open cleared", async () => {
      const opened = await openApplication(db, parent.userId, childId, placeId, "2026-10-03", "2026-10-06");
      await recordMove(db, host.userId, opened.application_id, "accept");
      await recordMove(db, host.userId, opened.application_id, "propose", "2026-10-04", "2026-10-07");
      await recordMove(db, parent.userId, opened.application_id, "reject");

      const f = await fold(db, opened.application_id);
      expect(f.status).toBe("confirmed");
      expect(isoDate(f.agreed_start)).toBe("2026-10-03");
      expect(isoDate(f.agreed_end)).toBe("2026-10-06");
      expect(f.open_start).toBeNull();
      expect(f.awaiting).toBeNull();
    });

    it("reject with no prior agreement -> rejected, terminal", async () => {
      const opened = await openApplication(db, parent.userId, childId, placeId, "2026-10-03", "2026-10-06");
      await recordMove(db, host.userId, opened.application_id, "reject");

      const f = await fold(db, opened.application_id);
      expect(f.status).toBe("rejected");
      expect(f.agreed_start).toBeNull();
      expect(f.open_start).toBeNull();
    });

    it("cancel -> cancelled, terminal, agreed dates no longer agreed", async () => {
      const opened = await openApplication(db, parent.userId, childId, placeId, "2026-10-03", "2026-10-06");
      await recordMove(db, host.userId, opened.application_id, "accept");
      await recordMove(db, parent.userId, opened.application_id, "cancel");

      const f = await fold(db, opened.application_id);
      expect(f.status).toBe("cancelled");
      expect(f.agreed_start).toBeNull();
      expect(f.agreed_end).toBeNull();
      expect(f.revision).toBe(2); // accept, then cancel-after-agreement
    });

    it("no move is accepted after a terminal phase", async () => {
      const opened = await openApplication(db, parent.userId, childId, placeId, "2026-10-03", "2026-10-06");
      await recordMove(db, host.userId, opened.application_id, "reject");

      await expect(recordMove(db, parent.userId, opened.application_id, "propose", "2026-10-10", "2026-10-12")).rejects.toThrow(
        "application_closed",
      );
      await expect(recordMove(db, parent.userId, opened.application_id, "cancel")).rejects.toThrow(
        "application_closed",
      );
    });
  });

  // -- record_move refusals and happy paths (task 2.2) ---------------------

  describe("record_move", () => {
    it("happy path: propose, accept, reject (on a new open change), cancel all record moves", async () => {
      const opened = await openApplication(db, parent.userId, childId, placeId, "2026-10-03", "2026-10-06");
      const counter = await recordMove(db, host.userId, opened.application_id, "propose", "2026-10-04", "2026-10-07");
      expect(counter.kind).toBe("propose");
      expect(counter.side).toBe("host");

      const accepted = await recordMove(db, parent.userId, opened.application_id, "accept");
      expect(accepted.status_after).toBe("confirmed");

      const changeProposed = await recordMove(
        db,
        host.userId,
        opened.application_id,
        "propose",
        "2026-10-05",
        "2026-10-08",
      );
      expect(changeProposed.status_after).toBe("confirmed");

      const rejected = await recordMove(db, parent.userId, opened.application_id, "reject");
      expect(rejected.status_after).toBe("confirmed");

      const cancelled = await recordMove(db, host.userId, opened.application_id, "cancel");
      expect(cancelled.status_after).toBe("cancelled");
    });

    it("a side cannot accept its own proposal", async () => {
      const opened = await openApplication(db, parent.userId, childId, placeId, "2026-10-03", "2026-10-06");
      await expect(recordMove(db, parent.userId, opened.application_id, "accept")).rejects.toThrow(
        "cannot_answer_own_proposal",
      );
    });

    it("a side cannot reject its own proposal", async () => {
      const opened = await openApplication(db, parent.userId, childId, placeId, "2026-10-03", "2026-10-06");
      await expect(recordMove(db, parent.userId, opened.application_id, "reject")).rejects.toThrow(
        "cannot_answer_own_proposal",
      );
    });

    it("accept/reject with no open proposal is refused", async () => {
      const opened = await openApplication(db, parent.userId, childId, placeId, "2026-10-03", "2026-10-06");
      await recordMove(db, host.userId, opened.application_id, "accept");

      await expect(recordMove(db, host.userId, opened.application_id, "accept")).rejects.toThrow(
        "no_open_proposal",
      );
      await expect(recordMove(db, host.userId, opened.application_id, "reject")).rejects.toThrow(
        "no_open_proposal",
      );
    });

    it("a bad date range on a counter-proposal is refused", async () => {
      const opened = await openApplication(db, parent.userId, childId, placeId, "2026-10-03", "2026-10-06");
      await expect(
        recordMove(db, host.userId, opened.application_id, "propose", "2026-10-10", "2026-10-10"),
      ).rejects.toThrow("invalid_dates");
      await expect(
        recordMove(db, host.userId, opened.application_id, "propose", null, "2026-10-10"),
      ).rejects.toThrow("invalid_dates");
    });

    it("an uninvolved member (or the admin) cannot move on an application", async () => {
      const opened = await openApplication(db, parent.userId, childId, placeId, "2026-10-03", "2026-10-06");
      await expect(recordMove(db, uninvolvedParent.userId, opened.application_id, "accept")).rejects.toThrow(
        "not_participant",
      );
      await expect(recordMove(db, admin.userId, opened.application_id, "accept")).rejects.toThrow(
        "not_participant",
      );
    });

    it("moving on a non-existent application is refused", async () => {
      await expect(
        recordMove(db, parent.userId, "00000000-0000-0000-0000-000000000000", "cancel"),
      ).rejects.toThrow("not_found");
    });

    it("overlapping accept is refused; the application's status is unchanged", async () => {
      const firstStay = await openApplication(db, parent.userId, childId, placeId, "2026-10-03", "2026-10-06");
      await recordMove(db, host.userId, firstStay.application_id, "accept");

      const secondStay = await openApplication(db, parent.userId, childId, placeId, "2026-10-05", "2026-10-08");
      await expect(recordMove(db, host.userId, secondStay.application_id, "accept")).rejects.toThrow(
        "overlap_conflict",
      );

      const f = await fold(db, secondStay.application_id);
      expect(f.status).toBe("negotiating");
      expect(f.agreed_start).toBeNull();
    });

    it("back-to-back stays (half-open ranges) do not overlap and both may be accepted", async () => {
      const firstStay = await openApplication(db, parent.userId, childId, placeId, "2026-10-01", "2026-10-03");
      await recordMove(db, host.userId, firstStay.application_id, "accept");

      const secondStay = await openApplication(db, parent.userId, childId, placeId, "2026-10-03", "2026-10-05");
      const accepted = await recordMove(db, host.userId, secondStay.application_id, "accept");
      expect(accepted.status_after).toBe("confirmed");
    });

    it("capacity: accept exceeding capacity is refused, status unchanged", async () => {
      const cappedPlace = await insertPlace(db, "Full House", host2, 1);
      const childA = await insertChild(db, "Child A", parent);
      const childB = await insertChild(db, "Child B", parent2);

      const stayA = await openApplication(db, parent.userId, childA, cappedPlace, "2026-10-03", "2026-10-06");
      await recordMove(db, host2.userId, stayA.application_id, "accept");

      const stayB = await openApplication(db, parent2.userId, childB, cappedPlace, "2026-10-04", "2026-10-07");
      await expect(recordMove(db, host2.userId, stayB.application_id, "accept")).rejects.toThrow(
        "capacity_exceeded",
      );

      const f = await fold(db, stayB.application_id);
      expect(f.status).toBe("negotiating");
    });

    it("capacity: a non-overlapping (different nights) accept at the same capped place succeeds", async () => {
      const cappedPlace = await insertPlace(db, "Full House", host2, 1);
      const childA = await insertChild(db, "Child A", parent);
      const childB = await insertChild(db, "Child B", parent2);

      const stayA = await openApplication(db, parent.userId, childA, cappedPlace, "2026-10-03", "2026-10-06");
      await recordMove(db, host2.userId, stayA.application_id, "accept");

      const stayB = await openApplication(db, parent2.userId, childB, cappedPlace, "2026-10-10", "2026-10-12");
      const accepted = await recordMove(db, host2.userId, stayB.application_id, "accept");
      expect(accepted.status_after).toBe("confirmed");
    });

    it("no capacity set: accepts are never refused for capacity", async () => {
      const openPlace = await insertPlace(db, "Open House", host2, null);
      const childA = await insertChild(db, "Child A", parent);
      const childB = await insertChild(db, "Child B", parent2);

      const stayA = await openApplication(db, parent.userId, childA, openPlace, "2026-10-03", "2026-10-06");
      await recordMove(db, host2.userId, stayA.application_id, "accept");

      const stayB = await openApplication(db, parent2.userId, childB, openPlace, "2026-10-04", "2026-10-07");
      const accepted = await recordMove(db, host2.userId, stayB.application_id, "accept");
      expect(accepted.status_after).toBe("confirmed");
    });
  });

  // -- place_capacity_status (task 2.4) -------------------------------------

  describe("place_capacity_status", () => {
    async function capacityStatus(userId: string, place: string, start: string, end: string) {
      const result = await asUser(db, userId, (tx) =>
        tx.query<{ night: string; agreed_count: number; at_capacity: boolean }>(
          `select * from place_capacity_status($1, $2, $3);`,
          [place, start, end],
        ),
      );
      return result.rows;
    }

    it("correct per-night counts across a multi-night range", async () => {
      const cappedPlace = await insertPlace(db, "Full House", host2, 2);
      const childA = await insertChild(db, "Child A", parent);
      const childB = await insertChild(db, "Child B", parent2);

      // A: Oct 3-6 (nights 3,4,5). B: Oct 5-8 (nights 5,6,7).
      const stayA = await openApplication(db, parent.userId, childA, cappedPlace, "2026-10-03", "2026-10-06");
      await recordMove(db, host2.userId, stayA.application_id, "accept");
      const stayB = await openApplication(db, parent2.userId, childB, cappedPlace, "2026-10-05", "2026-10-08");
      await recordMove(db, host2.userId, stayB.application_id, "accept");

      const nights = await capacityStatus(parent.userId, cappedPlace, "2026-10-03", "2026-10-08");
      const byNight = Object.fromEntries(nights.map((n) => [isoDate(n.night), n]));
      expect(byNight["2026-10-03"].agreed_count).toBe(1);
      expect(byNight["2026-10-04"].agreed_count).toBe(1);
      expect(byNight["2026-10-05"].agreed_count).toBe(2);
      expect(byNight["2026-10-05"].at_capacity).toBe(true);
      expect(byNight["2026-10-06"].agreed_count).toBe(1);
      expect(byNight["2026-10-07"].agreed_count).toBe(1);
    });

    it("unaffected by a place with no capacity set", async () => {
      const openPlace = await insertPlace(db, "Open House", host2, null);
      const childA = await insertChild(db, "Child A", parent);
      const stayA = await openApplication(db, parent.userId, childA, openPlace, "2026-10-03", "2026-10-06");
      await recordMove(db, host2.userId, stayA.application_id, "accept");

      const nights = await capacityStatus(parent.userId, openPlace, "2026-10-03", "2026-10-06");
      expect(nights.every((n) => n.at_capacity === false)).toBe(true);
      expect(nights.find((n) => isoDate(n.night) === "2026-10-04")?.agreed_count).toBe(1);
    });

    it("unaffected by another child's still-negotiating (not agreed) application", async () => {
      const cappedPlace = await insertPlace(db, "Full House", host2, 1);
      const childB = await insertChild(db, "Child B", parent2);

      // Only propose for child B — never accepted.
      await openApplication(db, parent2.userId, childB, cappedPlace, "2026-10-03", "2026-10-06");

      const nights = await capacityStatus(parent.userId, cappedPlace, "2026-10-03", "2026-10-06");
      expect(nights.every((n) => n.agreed_count === 0)).toBe(true);
      expect(nights.every((n) => n.at_capacity === false)).toBe(true);
    });
  });

  // -- delete_application (task 2.5) ----------------------------------------

  describe("delete_application", () => {
    it("a parent may permanently delete an unanswered application", async () => {
      const opened = await openApplication(db, parent.userId, childId, placeId, "2026-10-03", "2026-10-06");

      const result = await asUser(db, parent.userId, (tx) =>
        tx.query<{
          child_name: string;
          place_name: string;
          host_member_ids: string[];
          agreed_start: string | null;
          agreed_end: string | null;
          open_start: string;
          open_end: string;
        }>(`select * from delete_application($1);`, [opened.application_id]),
      );

      expect(result.rows[0].child_name).toBe("Lyanne");
      expect(result.rows[0].place_name).toBe("Grandma's");
      expect(result.rows[0].host_member_ids).toEqual([host.memberId]);
      expect(result.rows[0].agreed_start).toBeNull();
      expect(isoDate(result.rows[0].open_start)).toBe("2026-10-03");
      expect(isoDate(result.rows[0].open_end)).toBe("2026-10-06");

      const remaining = await db.query(`select 1 from application where id = $1;`, [opened.application_id]);
      expect(remaining.rows).toHaveLength(0);
      const remainingMoves = await db.query(`select 1 from move where application_id = $1;`, [
        opened.application_id,
      ]);
      expect(remainingMoves.rows).toHaveLength(0);
    });

    it("a parent cannot hard-delete once a host has responded", async () => {
      const opened = await openApplication(db, parent.userId, childId, placeId, "2026-10-03", "2026-10-06");
      await recordMove(db, host.userId, opened.application_id, "propose", "2026-10-04", "2026-10-07");

      await expect(
        asUser(db, parent.userId, (tx) => tx.query(`select * from delete_application($1);`, [opened.application_id])),
      ).rejects.toThrow("already_answered");

      const remaining = await db.query(`select 1 from application where id = $1;`, [opened.application_id]);
      expect(remaining.rows).toHaveLength(1);
    });

    it("a host can never hard-delete", async () => {
      const opened = await openApplication(db, parent.userId, childId, placeId, "2026-10-03", "2026-10-06");
      await expect(
        asUser(db, host.userId, (tx) => tx.query(`select * from delete_application($1);`, [opened.application_id])),
      ).rejects.toThrow("not_guardian_of_child");
    });

    it("the admin cannot hard-delete", async () => {
      const opened = await openApplication(db, parent.userId, childId, placeId, "2026-10-03", "2026-10-06");
      await expect(
        asUser(db, admin.userId, (tx) => tx.query(`select * from delete_application($1);`, [opened.application_id])),
      ).rejects.toThrow("not_guardian_of_child");
    });
  });
});

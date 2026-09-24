import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createTestDb, createUser } from "./harness";

/**
 * Task 2 (deviation) + task's "Read functions": `my_applications`,
 * `application_moves`, `set_place_capacity` (20260924001000_stays_reads.sql).
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

async function openApplication(
  db: PGlite,
  userId: string,
  child: string,
  place: string,
  start: string,
  end: string,
): Promise<string> {
  const result = await asUser(db, userId, (tx) =>
    tx.query<{ application_id: string }>(`select * from open_application($1, $2, $3, $4, null);`, [
      child,
      place,
      start,
      end,
    ]),
  );
  return result.rows[0].application_id;
}

describe("stays reads (my_applications, application_moves, set_place_capacity)", () => {
  let db: PGlite;
  let admin: Identity;
  let parent: Identity;
  let host: Identity;
  let uninvolved: Identity;
  let waitingParent: Identity;
  let childId: string;
  let placeId: string;
  let applicationId: string;

  beforeEach(async () => {
    db = await createTestDb();
    const adminUserId = await createUser(db, "admin@example.com");
    await db.query(`insert into app_admin (email) values ('admin@example.com');`);
    admin = { userId: adminUserId, memberId: "" };

    parent = await insertMember(db, "parent@example.com", "Mum", "parent");
    host = await insertMember(db, "host@example.com", "Grandma", "host");
    uninvolved = await insertMember(db, "stranger@example.com", "Stranger", "parent");
    waitingParent = await insertMember(db, "waiting@example.com", "Waiting", "parent", "waiting");

    childId = await insertChild(db, "Lyanne", parent);
    placeId = await insertPlace(db, "Grandma's", host);
    applicationId = await openApplication(db, parent.userId, childId, placeId, "2026-10-03", "2026-10-06");
  });

  afterEach(async () => {
    await db.close();
  });

  describe("my_applications", () => {
    it("is visible to the guardian parent, with their side and folded status", async () => {
      const rows = await asUser(db, parent.userId, (tx) => tx.query(`select * from my_applications();`));
      expect(rows.rows).toHaveLength(1);
      const row = rows.rows[0] as Record<string, unknown>;
      expect(row.child_name).toBe("Lyanne");
      expect(row.place_name).toBe("Grandma's");
      expect(row.viewer_side).toBe("parent");
      expect(row.status).toBe("negotiating");
    });

    it("is visible to the host, with side 'host'", async () => {
      const rows = await asUser(db, host.userId, (tx) => tx.query(`select * from my_applications();`));
      expect(rows.rows).toHaveLength(1);
      expect((rows.rows[0] as Record<string, unknown>).viewer_side).toBe("host");
    });

    it("is visible to the admin, with a null side", async () => {
      const rows = await asUser(db, admin.userId, (tx) => tx.query(`select * from my_applications();`));
      expect(rows.rows).toHaveLength(1);
      expect((rows.rows[0] as Record<string, unknown>).viewer_side).toBeNull();
    });

    it("is invisible to an uninvolved active member", async () => {
      const rows = await asUser(db, uninvolved.userId, (tx) => tx.query(`select * from my_applications();`));
      expect(rows.rows).toHaveLength(0);
    });

    it("is invisible to a waiting member", async () => {
      const rows = await asUser(db, waitingParent.userId, (tx) => tx.query(`select * from my_applications();`));
      expect(rows.rows).toHaveLength(0);
    });

    it("refuses a signed-out caller", async () => {
      await expect(db.query(`select * from my_applications();`)).rejects.toThrow();
    });
  });

  describe("application_moves", () => {
    it("returns the mover's display name for the guardian parent", async () => {
      const rows = await asUser(db, parent.userId, (tx) =>
        tx.query<{ by_name: string; kind: string }>(`select * from application_moves($1);`, [applicationId]),
      );
      expect(rows.rows).toHaveLength(1);
      expect(rows.rows[0].by_name).toBe("Mum");
      expect(rows.rows[0].kind).toBe("propose");
    });

    it("returns the mover's display name for the host, including a parent's name", async () => {
      const rows = await asUser(db, host.userId, (tx) =>
        tx.query<{ by_name: string }>(`select * from application_moves($1);`, [applicationId]),
      );
      expect(rows.rows).toHaveLength(1);
      expect(rows.rows[0].by_name).toBe("Mum");
    });

    it("is refused for an uninvolved member", async () => {
      await expect(
        asUser(db, uninvolved.userId, (tx) => tx.query(`select * from application_moves($1);`, [applicationId])),
      ).rejects.toThrow("not_participant");
    });

    it("is visible to the admin", async () => {
      const rows = await asUser(db, admin.userId, (tx) =>
        tx.query(`select * from application_moves($1);`, [applicationId]),
      );
      expect(rows.rows).toHaveLength(1);
    });
  });

  describe("application_participants", () => {
    it("returns both sides' active members with email, for the parent caller", async () => {
      const rows = await asUser(db, parent.userId, (tx) =>
        tx.query<{ name: string; email: string; side: string }>(
          `select * from application_participants($1);`,
          [applicationId],
        ),
      );
      const bySide = Object.fromEntries(rows.rows.map((r) => [r.side, r]));
      expect(bySide.parent.email).toBe("parent@example.com");
      expect(bySide.host.email).toBe("host@example.com");
    });

    it("returns both sides' active members for the host caller too", async () => {
      const rows = await asUser(db, host.userId, (tx) =>
        tx.query<{ side: string }>(`select * from application_participants($1);`, [applicationId]),
      );
      expect(rows.rows.map((r) => r.side).sort()).toEqual(["host", "parent"]);
    });

    it("is refused for an uninvolved member", async () => {
      await expect(
        asUser(db, uninvolved.userId, (tx) =>
          tx.query(`select * from application_participants($1);`, [applicationId]),
        ),
      ).rejects.toThrow("not_participant");
    });
  });

  describe("set_place_capacity", () => {
    it("a host sets the place's capacity", async () => {
      await asUser(db, host.userId, (tx) => tx.query(`select set_place_capacity($1, $2);`, [placeId, 2]));
      const result = await db.query<{ capacity: number | null }>(`select capacity from place where id = $1;`, [
        placeId,
      ]);
      expect(result.rows[0].capacity).toBe(2);
    });

    it("a host clears the place's capacity with null", async () => {
      await asUser(db, host.userId, (tx) => tx.query(`select set_place_capacity($1, $2);`, [placeId, 2]));
      await asUser(db, host.userId, (tx) => tx.query(`select set_place_capacity($1, $2);`, [placeId, null]));
      const result = await db.query<{ capacity: number | null }>(`select capacity from place where id = $1;`, [
        placeId,
      ]);
      expect(result.rows[0].capacity).toBeNull();
    });

    it("refuses a non-positive capacity", async () => {
      await expect(
        asUser(db, host.userId, (tx) => tx.query(`select set_place_capacity($1, $2);`, [placeId, 0])),
      ).rejects.toThrow("invalid_capacity");
    });

    it("refuses a member who does not host this place", async () => {
      await expect(
        asUser(db, parent.userId, (tx) => tx.query(`select set_place_capacity($1, $2);`, [placeId, 2])),
      ).rejects.toThrow("not_host_of_place");
    });

    it("the admin may set capacity", async () => {
      await asUser(db, admin.userId, (tx) => tx.query(`select set_place_capacity($1, $2);`, [placeId, 3]));
      const result = await db.query<{ capacity: number | null }>(`select capacity from place where id = $1;`, [
        placeId,
      ]);
      expect(result.rows[0].capacity).toBe(3);
    });
  });
});

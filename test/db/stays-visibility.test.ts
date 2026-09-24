import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asAnon, asUser, createTestDb, createUser } from "./harness";

/** Task 3: `application`/`move` RLS, and the two visibility extensions
 * (design Decision 8). */

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

async function insertPlace(db: PGlite, name: string, host: Identity, address: string | null = null): Promise<string> {
  const result = await db.query<{ id: string }>(
    `insert into place (name, address, time_zone, created_by) values ($1, $2, 'Asia/Singapore', $3) returning id;`,
    [name, address, host.memberId],
  );
  const placeId = result.rows[0].id;
  await db.query(`insert into place_host (member_id, place_id) values ($1, $2);`, [host.memberId, placeId]);
  return placeId;
}

async function insertApplication(db: PGlite, child: string, place: string, creator: Identity): Promise<string> {
  const result = await db.query<{ id: string }>(
    `insert into application (child_id, place_id, created_by) values ($1, $2, $3) returning id;`,
    [child, place, creator.memberId],
  );
  const applicationId = result.rows[0].id;
  await db.query(
    `insert into move (application_id, kind, side, by, date_start, date_end)
     values ($1, 'propose', 'parent', $2, '2026-10-03', '2026-10-06');`,
    [applicationId, creator.memberId],
  );
  return applicationId;
}

describe("stays visibility (RLS on application/move; child/place extensions)", () => {
  let db: PGlite;
  let adminUserId: string;
  let parent: Identity;
  let host: Identity;
  let uninvolved: Identity;
  let waitingParent: Identity;
  let deactivatedHost: Identity;
  let childId: string;
  let placeId: string;
  let applicationId: string;

  beforeEach(async () => {
    db = await createTestDb();
    adminUserId = await createUser(db, "admin@example.com");
    await db.query(`insert into app_admin (email) values ('admin@example.com');`);

    parent = await insertMember(db, "parent@example.com", "Parent", "parent");
    host = await insertMember(db, "host@example.com", "Host", "host");
    uninvolved = await insertMember(db, "uninvolved@example.com", "Uninvolved", "parent");
    waitingParent = await insertMember(db, "waiting@example.com", "Waiting", "parent", "waiting");
    deactivatedHost = await insertMember(db, "deactivated@example.com", "Deactivated", "host", "deactivated");

    childId = await insertChild(db, "Lyanne", parent);
    placeId = await insertPlace(db, "Grandma's", host, "1 Example St");
    applicationId = await insertApplication(db, childId, placeId, parent);
  });

  afterEach(async () => {
    await db.close();
  });

  it("the parent guardian sees the application and its moves", async () => {
    const apps = await asUser(db, parent.userId, (tx) => tx.query<{ id: string }>(`select id from application;`));
    expect(apps.rows.map((r) => r.id)).toEqual([applicationId]);

    const moves = await asUser(db, parent.userId, (tx) =>
      tx.query<{ application_id: string }>(`select application_id from move;`),
    );
    expect(moves.rows.map((r) => r.application_id)).toEqual([applicationId]);
  });

  it("the host of the place sees the application and its moves", async () => {
    const apps = await asUser(db, host.userId, (tx) => tx.query<{ id: string }>(`select id from application;`));
    expect(apps.rows.map((r) => r.id)).toEqual([applicationId]);

    const moves = await asUser(db, host.userId, (tx) =>
      tx.query<{ application_id: string }>(`select application_id from move;`),
    );
    expect(moves.rows.map((r) => r.application_id)).toEqual([applicationId]);
  });

  it("an uninvolved active member sees nothing", async () => {
    const apps = await asUser(db, uninvolved.userId, (tx) => tx.query(`select id from application;`));
    expect(apps.rows).toHaveLength(0);
    const moves = await asUser(db, uninvolved.userId, (tx) => tx.query(`select id from move;`));
    expect(moves.rows).toHaveLength(0);
  });

  it("a waiting or deactivated member sees nothing", async () => {
    for (const identity of [waitingParent, deactivatedHost]) {
      const apps = await asUser(db, identity.userId, (tx) => tx.query(`select id from application;`));
      expect(apps.rows).toHaveLength(0);
      const moves = await asUser(db, identity.userId, (tx) => tx.query(`select id from move;`));
      expect(moves.rows).toHaveLength(0);
    }
  });

  it("the admin sees every application and move", async () => {
    const apps = await asUser(db, adminUserId, (tx) => tx.query<{ id: string }>(`select id from application;`));
    expect(apps.rows.map((r) => r.id)).toEqual([applicationId]);
    const moves = await asUser(db, adminUserId, (tx) => tx.query(`select id from move;`));
    expect(moves.rows).toHaveLength(1);
  });

  it("direct insert/update/delete on application or move are refused for every app role", async () => {
    for (const userId of [parent.userId, host.userId, adminUserId]) {
      await expect(
        asUser(db, userId, (tx) =>
          tx.query(`insert into application (child_id, place_id, created_by) values ($1, $2, $3);`, [
            childId,
            placeId,
            parent.memberId,
          ]),
        ),
      ).rejects.toThrow();
      await expect(
        asUser(db, userId, (tx) =>
          tx.query(`update application set created_by = created_by where id = $1;`, [applicationId]),
        ),
      ).rejects.toThrow();
      await expect(
        asUser(db, userId, (tx) => tx.query(`delete from application where id = $1;`, [applicationId])),
      ).rejects.toThrow();

      await expect(
        asUser(db, userId, (tx) =>
          tx.query(
            `insert into move (application_id, kind, side, by) values ($1, 'cancel', 'parent', $2);`,
            [applicationId, parent.memberId],
          ),
        ),
      ).rejects.toThrow();
      await expect(
        asUser(db, userId, (tx) => tx.query(`update move set note = 'x' where application_id = $1;`, [applicationId])),
      ).rejects.toThrow();
      await expect(
        asUser(db, userId, (tx) => tx.query(`delete from move where application_id = $1;`, [applicationId])),
      ).rejects.toThrow();
    }
  });

  it("anon cannot select application or move", async () => {
    await expect(asAnon(db, (tx) => tx.query(`select * from application;`))).rejects.toThrow();
    await expect(asAnon(db, (tx) => tx.query(`select * from move;`))).rejects.toThrow();
  });

  // -- Visibility extensions (design Decision 8) ----------------------------

  it("a host sees the child's name only after an application links them, not before", async () => {
    const otherHost = await insertMember(db, "other-host@example.com", "OtherHost", "host");
    const otherPlace = await insertPlace(db, "Other Place", otherHost);

    // otherHost has no application at any place the child is linked to.
    const before = await asUser(db, otherHost.userId, (tx) => tx.query(`select id from child;`));
    expect(before.rows).toHaveLength(0);

    await insertApplication(db, childId, otherPlace, parent);

    const after = await asUser(db, otherHost.userId, (tx) =>
      tx.query<{ id: string; name: string }>(`select id, name from child;`),
    );
    expect(after.rows.map((r) => r.id)).toEqual([childId]);
    expect(after.rows[0].name).toBe("Lyanne");
  });

  it("a parent sees a home's address only after applying there, not before", async () => {
    const otherParent = await insertMember(db, "other-parent@example.com", "OtherParent", "parent");
    const otherChild = await insertChild(db, "OtherChild", otherParent);

    const before = await asUser(db, otherParent.userId, (tx) => tx.query(`select id from place;`));
    expect(before.rows).toHaveLength(0);

    await insertApplication(db, otherChild, placeId, otherParent);

    const after = await asUser(db, otherParent.userId, (tx) =>
      tx.query<{ id: string; address: string | null }>(`select id, address from place;`),
    );
    expect(after.rows.map((r) => r.id)).toEqual([placeId]);
    expect(after.rows[0].address).toBe("1 Example St");
  });

  it("a host with no application linking them still cannot see the child", async () => {
    const otherHost = await insertMember(db, "no-app-host@example.com", "NoAppHost", "host");
    await insertPlace(db, "No App Place", otherHost);

    const result = await asUser(db, otherHost.userId, (tx) => tx.query(`select id from child;`));
    expect(result.rows).toHaveLength(0);
  });

  it("existing foundation visibility (guardians, place hosts, directory-without-address) is unaffected", async () => {
    // Guardian still sees only their own child (no application-based leak of
    // an unrelated child).
    const otherParent = await insertMember(db, "unrelated-parent@example.com", "Unrelated", "parent");
    const otherChild = await insertChild(db, "Unrelated Child", otherParent);
    void otherChild;

    const parentChildren = await asUser(db, parent.userId, (tx) => tx.query<{ id: string }>(`select id from child;`));
    expect(parentChildren.rows.map((r) => r.id)).toEqual([childId]);

    // Host still sees only the place(s) they host, plus now places they have
    // an application-based link to (none here), never an unrelated place.
    const otherHost = await insertMember(db, "unrelated-host@example.com", "UnrelatedHost", "host");
    const unrelatedPlace = await insertPlace(db, "Unrelated Place", otherHost);
    void unrelatedPlace;

    const hostPlaces = await asUser(db, host.userId, (tx) => tx.query<{ id: string }>(`select id from place;`));
    expect(hostPlaces.rows.map((r) => r.id)).toEqual([placeId]);

    // home_directory() still hides addresses for an uninvolved active member.
    const directory = await asUser(db, uninvolved.userId, (tx) =>
      tx.query<{ id: string; name: string }>(`select * from home_directory();`),
    );
    expect(directory.rows.every((r) => !("address" in r))).toBe(true);
    expect(directory.rows.some((r) => r.id === placeId)).toBe(true);
  });
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asAnon, asUser, createTestDb, createUser } from "./harness";

interface Identity {
  userId: string;
  memberId: string;
}

interface Seed {
  adminUserId: string;
  p1: Identity;
  p2: Identity;
  p3: Identity;
  h1: Identity;
  h2: Identity;
  h3: Identity;
  w: Identity;
  d: Identity;
  strangerUserId: string;
  childId: string;
  placeH: string;
  placeK: string;
}

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

/**
 * Seeds admin identity (email on app_admin, no member), parents P1
 * (child C1), P2 (co-parent of C1), P3 (active, no links), host H1 (place H
 * with address), host H2 (co-host of H), host H3 (place K), a waiting parent
 * W, a deactivated host D, and a stranger identity with no member — all as
 * the superuser (db.exec/db.query outside any asUser/asAnon wrapping), the
 * same way migrations run.
 */
async function seedAll(db: PGlite): Promise<Seed> {
  const adminUserId = await createUser(db, "admin@example.com");
  await db.query(`insert into app_admin (email) values ($1);`, ["admin@example.com"]);

  const p1UserId = await createUser(db, "p1@example.com");
  const p1MemberId = await insertMember(db, p1UserId, "P1", "parent", "active");

  const p2UserId = await createUser(db, "p2@example.com");
  const p2MemberId = await insertMember(db, p2UserId, "P2", "parent", "active");

  const p3UserId = await createUser(db, "p3@example.com");
  const p3MemberId = await insertMember(db, p3UserId, "P3", "parent", "active");

  const h1UserId = await createUser(db, "h1@example.com");
  const h1MemberId = await insertMember(db, h1UserId, "H1", "host", "active");

  const h2UserId = await createUser(db, "h2@example.com");
  const h2MemberId = await insertMember(db, h2UserId, "H2", "host", "active");

  const h3UserId = await createUser(db, "h3@example.com");
  const h3MemberId = await insertMember(db, h3UserId, "H3", "host", "active");

  const wUserId = await createUser(db, "w@example.com");
  const wMemberId = await insertMember(db, wUserId, "W", "parent", "waiting");

  const dUserId = await createUser(db, "d@example.com");
  const dMemberId = await insertMember(db, dUserId, "D", "host", "deactivated");

  const strangerUserId = await createUser(db, "stranger@example.com");

  const childResult = await db.query<{ id: string }>(
    `insert into child (name, created_by) values ('C1', $1) returning id;`,
    [p1MemberId],
  );
  const childId = childResult.rows[0].id;
  await db.query(
    `insert into guardian (member_id, child_id) values ($1, $3), ($2, $3);`,
    [p1MemberId, p2MemberId, childId],
  );

  const placeHResult = await db.query<{ id: string }>(
    `insert into place (name, address, time_zone, created_by)
     values ('H', '1 Example St', 'Asia/Singapore', $1) returning id;`,
    [h1MemberId],
  );
  const placeH = placeHResult.rows[0].id;
  await db.query(
    `insert into place_host (member_id, place_id) values ($1, $3), ($2, $3);`,
    [h1MemberId, h2MemberId, placeH],
  );

  const placeKResult = await db.query<{ id: string }>(
    `insert into place (name, address, time_zone, created_by)
     values ('K', null, 'Asia/Tokyo', $1) returning id;`,
    [h3MemberId],
  );
  const placeK = placeKResult.rows[0].id;
  await db.query(`insert into place_host (member_id, place_id) values ($1, $2);`, [h3MemberId, placeK]);

  return {
    adminUserId,
    p1: { userId: p1UserId, memberId: p1MemberId },
    p2: { userId: p2UserId, memberId: p2MemberId },
    p3: { userId: p3UserId, memberId: p3MemberId },
    h1: { userId: h1UserId, memberId: h1MemberId },
    h2: { userId: h2UserId, memberId: h2MemberId },
    h3: { userId: h3UserId, memberId: h3MemberId },
    w: { userId: wUserId, memberId: wMemberId },
    d: { userId: dUserId, memberId: dMemberId },
    strangerUserId,
    childId,
    placeH,
    placeK,
  };
}

function ids(rows: Array<{ id: string }>): string[] {
  return rows.map((r) => r.id).sort();
}

describe("foundation visibility (RLS + grants)", () => {
  let db: PGlite;

  beforeEach(async () => {
    db = await createTestDb();
  });

  afterEach(async () => {
    await db.close();
  });

  it("P1 sees C1, its guardian rows, and members P1+P2 only", async () => {
    const seed = await seedAll(db);

    const children = await asUser(db, seed.p1.userId, (tx) =>
      tx.query<{ id: string }>(`select id from child;`),
    );
    expect(ids(children.rows)).toEqual([seed.childId]);

    const guardians = await asUser(db, seed.p1.userId, (tx) =>
      tx.query<{ member_id: string; child_id: string }>(`select member_id, child_id from guardian;`),
    );
    expect(guardians.rows.map((r) => r.member_id).sort()).toEqual(
      [seed.p1.memberId, seed.p2.memberId].sort(),
    );
    expect(guardians.rows.every((r) => r.child_id === seed.childId)).toBe(true);

    const members = await asUser(db, seed.p1.userId, (tx) =>
      tx.query<{ id: string }>(`select id from member;`),
    );
    expect(ids(members.rows)).toEqual([seed.p1.memberId, seed.p2.memberId].sort());

    const places = await asUser(db, seed.p1.userId, (tx) => tx.query(`select id from place;`));
    expect(places.rows).toHaveLength(0);

    const placeHosts = await asUser(db, seed.p1.userId, (tx) => tx.query(`select member_id from place_host;`));
    expect(placeHosts.rows).toHaveLength(0);
  });

  it("H1 sees place H with its address, place_host rows of H, and members H1+H2 only", async () => {
    const seed = await seedAll(db);

    const places = await asUser(db, seed.h1.userId, (tx) =>
      tx.query<{ id: string; address: string | null }>(`select id, address from place;`),
    );
    expect(ids(places.rows)).toEqual([seed.placeH]);
    expect(places.rows[0].address).toBe("1 Example St");

    const hosts = await asUser(db, seed.h1.userId, (tx) =>
      tx.query<{ member_id: string; place_id: string }>(`select member_id, place_id from place_host;`),
    );
    expect(hosts.rows.map((r) => r.member_id).sort()).toEqual(
      [seed.h1.memberId, seed.h2.memberId].sort(),
    );
    expect(hosts.rows.every((r) => r.place_id === seed.placeH)).toBe(true);

    const members = await asUser(db, seed.h1.userId, (tx) =>
      tx.query<{ id: string }>(`select id from member;`),
    );
    expect(ids(members.rows)).toEqual([seed.h1.memberId, seed.h2.memberId].sort());

    const children = await asUser(db, seed.h1.userId, (tx) => tx.query(`select id from child;`));
    expect(children.rows).toHaveLength(0);
  });

  it("P3 sees no children/places, only itself as a member, and home_directory() shows H and K without addresses", async () => {
    const seed = await seedAll(db);

    const children = await asUser(db, seed.p3.userId, (tx) => tx.query(`select id from child;`));
    expect(children.rows).toHaveLength(0);

    const places = await asUser(db, seed.p3.userId, (tx) => tx.query(`select id from place;`));
    expect(places.rows).toHaveLength(0);

    const members = await asUser(db, seed.p3.userId, (tx) =>
      tx.query<{ id: string }>(`select id from member;`),
    );
    expect(ids(members.rows)).toEqual([seed.p3.memberId]);

    const directory = await asUser(db, seed.p3.userId, (tx) =>
      tx.query<{ id: string; name: string; time_zone: string }>(`select * from home_directory();`),
    );
    expect(ids(directory.rows)).toEqual([seed.placeH, seed.placeK].sort());
    expect(new Set(directory.rows.map((r) => r.name))).toEqual(new Set(["H", "K"]));
    expect(directory.rows.every((r) => "time_zone" in r)).toBe(true);
    expect(directory.rows.every((r) => !("address" in r))).toBe(true);
  });

  it("waiting, deactivated and unregistered identities see zero rows everywhere and no home directory", async () => {
    const seed = await seedAll(db);
    const strangers = [seed.w.userId, seed.d.userId, seed.strangerUserId];

    for (const userId of strangers) {
      for (const table of ["member", "child", "place", "guardian", "place_host"]) {
        const result = await asUser(db, userId, (tx) => tx.query(`select * from ${table};`));
        expect(result.rows, `${table} for ${userId}`).toHaveLength(0);
      }
      const directory = await asUser(db, userId, (tx) => tx.query(`select * from home_directory();`));
      expect(directory.rows).toHaveLength(0);
    }
  });

  it("admin sees all rows in all five family tables", async () => {
    const seed = await seedAll(db);

    const expectedCounts: Record<string, number> = {
      member: 8, // p1, p2, p3, h1, h2, h3, w, d (admin has no member row)
      child: 1,
      place: 2,
      guardian: 2,
      place_host: 3,
    };

    for (const [table, count] of Object.entries(expectedCounts)) {
      const superuserCount = await db.query<{ n: string }>(`select count(*)::int as n from ${table};`);
      expect(Number(superuserCount.rows[0].n)).toBe(count);

      const asAdmin = await asUser(db, seed.adminUserId, (tx) => tx.query(`select * from ${table};`));
      expect(asAdmin.rows).toHaveLength(count);
    }
  });

  it("authenticated cannot select app_admin, app_setting or join_attempt", async () => {
    const seed = await seedAll(db);

    for (const table of ["app_admin", "app_setting", "join_attempt"]) {
      await expect(
        asUser(db, seed.p1.userId, (tx) => tx.query(`select * from ${table};`)),
      ).rejects.toThrow();
    }
  });

  it("anon cannot select any table and cannot execute home_directory()", async () => {
    await seedAll(db);

    for (const table of [
      "member",
      "child",
      "place",
      "guardian",
      "place_host",
      "app_admin",
      "app_setting",
      "join_attempt",
    ]) {
      await expect(asAnon(db, (tx) => tx.query(`select * from ${table};`))).rejects.toThrow();
    }

    await expect(asAnon(db, (tx) => tx.query(`select * from home_directory();`))).rejects.toThrow();
  });

  it("direct insert/update/delete on the family tables are refused for P1, H1 and admin", async () => {
    const seed = await seedAll(db);

    for (const userId of [seed.p1.userId, seed.h1.userId, seed.adminUserId]) {
      await expect(
        asUser(db, userId, (tx) =>
          tx.query(
            `insert into member (user_id, name, role, status) values (gen_random_uuid(), 'X', 'parent', 'active');`,
          ),
        ),
      ).rejects.toThrow();
      await expect(
        asUser(db, userId, (tx) => tx.query(`update member set name = 'Y' where id = $1;`, [seed.p1.memberId])),
      ).rejects.toThrow();
      await expect(
        asUser(db, userId, (tx) => tx.query(`delete from member where id = $1;`, [seed.p1.memberId])),
      ).rejects.toThrow();

      await expect(
        asUser(db, userId, (tx) =>
          tx.query(`insert into child (name, created_by) values ('X', $1);`, [seed.p1.memberId]),
        ),
      ).rejects.toThrow();
      await expect(
        asUser(db, userId, (tx) => tx.query(`update child set name = 'Y' where id = $1;`, [seed.childId])),
      ).rejects.toThrow();
      await expect(
        asUser(db, userId, (tx) => tx.query(`delete from child where id = $1;`, [seed.childId])),
      ).rejects.toThrow();

      await expect(
        asUser(db, userId, (tx) =>
          tx.query(
            `insert into place (name, time_zone, created_by) values ('X', 'Asia/Tokyo', $1);`,
            [seed.h1.memberId],
          ),
        ),
      ).rejects.toThrow();
      await expect(
        asUser(db, userId, (tx) => tx.query(`update place set name = 'Y' where id = $1;`, [seed.placeH])),
      ).rejects.toThrow();
      await expect(
        asUser(db, userId, (tx) => tx.query(`delete from place where id = $1;`, [seed.placeH])),
      ).rejects.toThrow();

      await expect(
        asUser(db, userId, (tx) =>
          tx.query(`insert into guardian (member_id, child_id) values ($1, $2);`, [
            seed.p3.memberId,
            seed.childId,
          ]),
        ),
      ).rejects.toThrow();
      await expect(
        asUser(db, userId, (tx) =>
          tx.query(`delete from guardian where member_id = $1 and child_id = $2;`, [
            seed.p1.memberId,
            seed.childId,
          ]),
        ),
      ).rejects.toThrow();

      await expect(
        asUser(db, userId, (tx) =>
          tx.query(`insert into place_host (member_id, place_id) values ($1, $2);`, [
            seed.h3.memberId,
            seed.placeH,
          ]),
        ),
      ).rejects.toThrow();
      await expect(
        asUser(db, userId, (tx) =>
          tx.query(`delete from place_host where member_id = $1 and place_id = $2;`, [
            seed.h1.memberId,
            seed.placeH,
          ]),
        ),
      ).rejects.toThrow();
    }
  });

  it("flip check: granting INSERT to authenticated (with a matching RLS policy) does let a write through", async () => {
    // Proves the previous test's refusals come from the missing GRANT (plus
    // the absence of any write policy) — not from something incidental like
    // a check constraint or a bad SQL statement. Uses a disposable table so
    // production tables/policies are untouched.
    const flipDb = await createTestDb();
    try {
      await flipDb.exec(`
        create table write_guard_demo (
          id uuid primary key default gen_random_uuid(),
          note text not null
        );
        alter table write_guard_demo enable row level security;
        -- Both INSERT and SELECT so a successful insert can be confirmed by
        -- reading it back as the same user (RLS would otherwise refuse the
        -- implicit SELECT an INSERT ... RETURNING needs, which is a
        -- different guard than the one this test isolates).
        create policy write_guard_demo_insert on write_guard_demo
          for insert to authenticated
          with check (true);
        create policy write_guard_demo_select on write_guard_demo
          for select to authenticated
          using (true);
        -- The test shim's default privileges grant ALL on new tables to
        -- authenticated (Prerequisite A, mirroring real Supabase); undo the
        -- insert grant for this one table so it starts from the same
        -- "no grant" state as member/child/place/guardian/place_host after
        -- the foundation visibility migration's revoke.
        revoke insert on write_guard_demo from authenticated;
      `);
      const userId = await createUser(flipDb, "flip@example.com");

      // No GRANT INSERT yet: refused even though a permissive policy exists.
      await expect(
        asUser(flipDb, userId, (tx) =>
          tx.query(`insert into write_guard_demo (note) values ('no grant yet');`),
        ),
      ).rejects.toThrow();

      await flipDb.exec(`grant insert on write_guard_demo to authenticated;`);

      // Same statement now succeeds once the grant exists.
      await asUser(flipDb, userId, (tx) =>
        tx.query(`insert into write_guard_demo (note) values ('granted now');`),
      );
      const seen = await asUser(flipDb, userId, (tx) =>
        tx.query<{ note: string }>(`select note from write_guard_demo where note = 'granted now';`),
      );
      expect(seen.rows).toHaveLength(1);
    } finally {
      await flipDb.close();
    }
  });

  it("check constraints reject bad data (as superuser)", async () => {
    const blankUserId = await createUser(db, "blank-name@example.com");
    await expect(
      db.query(`insert into member (user_id, name, role, status) values ($1, '   ', 'parent', 'active');`, [
        blankUserId,
      ]),
    ).rejects.toThrow();

    const badRoleUserId = await createUser(db, "bad-role@example.com");
    await expect(
      db.query(`insert into member (user_id, name, role, status) values ($1, 'X', 'admin', 'active');`, [
        badRoleUserId,
      ]),
    ).rejects.toThrow();

    const badStatusUserId = await createUser(db, "bad-status@example.com");
    await expect(
      db.query(`insert into member (user_id, name, role, status) values ($1, 'X', 'parent', 'banned');`, [
        badStatusUserId,
      ]),
    ).rejects.toThrow();

    const hostUserId = await createUser(db, "long-address-host@example.com");
    const hostMemberId = await insertMember(db, hostUserId, "Host", "host", "active");
    const longAddress = "A".repeat(301);
    await expect(
      db.query(
        `insert into place (name, address, time_zone, created_by) values ('X', $1, 'Asia/Tokyo', $2);`,
        [longAddress, hostMemberId],
      ),
    ).rejects.toThrow();

    await expect(db.query(`insert into app_admin (email) values ('Upper@Example.com');`)).rejects.toThrow();
  });
});

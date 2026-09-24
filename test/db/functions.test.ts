import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asAnon, asUser, createTestDb, createUser } from "./harness";

interface RegisterRow {
  outcome: string;
  member_id: string | null;
  attempts_left: number;
}

interface MyAccountRow {
  member_id: string | null;
  name: string | null;
  role: string | null;
  status: string | null;
  email: string;
  is_admin: boolean;
  code_attempts_left: number;
}

/** Inserts a member row directly (as the superuser), the same way migrations
 * and fixtures in visibility.test.ts do — used here to set up cross-links
 * (co-parents, co-hosts, waiting/deactivated accounts) without going through
 * register()/approve_member() every time, so each test exercises the one
 * function it names. */
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

async function setJoinCode(db: PGlite, adminUserId: string, code: string | null): Promise<void> {
  await asUser(db, adminUserId, (tx) => tx.query(`select set_join_code($1);`, [code]));
}

async function myAccount(db: PGlite, userId: string): Promise<MyAccountRow> {
  const result = await asUser(db, userId, (tx) => tx.query<MyAccountRow>(`select * from my_account();`));
  return result.rows[0];
}

describe("foundation functions (register, admin, children & homes)", () => {
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

  // -- register / join code -------------------------------------------------

  describe("register / join code", () => {
    it("correct code creates an active member", async () => {
      await setJoinCode(db, adminUserId, "letmein");
      const userId = await createUser(db, "grandma@example.com");

      const row = await register(db, userId, "host", "Grandma", "letmein");
      expect(row.outcome).toBe("active");
      expect(row.member_id).not.toBeNull();

      const stored = await db.query<{ status: string }>(`select status from member where id = $1;`, [
        row.member_id,
      ]);
      expect(stored.rows[0].status).toBe("active");
    });

    it("no code creates a waiting member", async () => {
      await setJoinCode(db, adminUserId, "letmein");
      const userId = await createUser(db, "dad@example.com");

      const row = await register(db, userId, "parent", "Dad", null);
      expect(row.outcome).toBe("waiting");
      expect(row.member_id).not.toBeNull();

      const stored = await db.query<{ status: string }>(`select status from member where id = $1;`, [
        row.member_id,
      ]);
      expect(stored.rows[0].status).toBe("waiting");
    });

    it("wrong code is refused without creating a member, and increments the attempt counter", async () => {
      await setJoinCode(db, adminUserId, "letmein");
      const userId = await createUser(db, "stranger1@example.com");

      const row = await register(db, userId, "parent", "Stranger", "wrongcode");
      expect(row.outcome).toBe("wrong_code");
      expect(row.member_id).toBeNull();
      expect(row.attempts_left).toBe(4);

      const members = await db.query(`select 1 from member where user_id = $1;`, [userId]);
      expect(members.rows).toHaveLength(0);

      const attempt = await db.query<{ wrong_count: number }>(
        `select wrong_count from join_attempt where user_id = $1;`,
        [userId],
      );
      expect(attempt.rows[0].wrong_count).toBe(1);
    });

    it("the attempt counter persists across calls: after 5 wrong codes, the 6th attempt waits even with the right code", async () => {
      await setJoinCode(db, adminUserId, "letmein");
      const userId = await createUser(db, "persistent@example.com");

      for (let i = 0; i < 5; i++) {
        const row = await register(db, userId, "parent", "Persistent", "nope");
        expect(row.outcome).toBe("wrong_code");
      }

      const attempt = await db.query<{ wrong_count: number }>(
        `select wrong_count from join_attempt where user_id = $1;`,
        [userId],
      );
      expect(attempt.rows[0].wrong_count).toBe(5);

      // 6th attempt, this time with the *correct* code — still waits,
      // because attempts are exhausted and the code is not even checked.
      const sixth = await register(db, userId, "parent", "Persistent", "letmein");
      expect(sixth.outcome).toBe("waiting");
      expect(sixth.attempts_left).toBe(0);
    });

    it("no code set at all creates a waiting member even though a code was entered", async () => {
      // app_setting.join_code_hash is null by default (no setJoinCode call).
      const userId = await createUser(db, "nocode@example.com");

      const row = await register(db, userId, "host", "NoCode", "anything");
      expect(row.outcome).toBe("waiting");
    });

    it("changing the code leaves existing members unchanged", async () => {
      await setJoinCode(db, adminUserId, "original");
      const userId = await createUser(db, "existing@example.com");
      const first = await register(db, userId, "parent", "Existing", "original");
      expect(first.outcome).toBe("active");

      await setJoinCode(db, adminUserId, "newcode");

      const stillActive = await db.query<{ status: string }>(`select status from member where id = $1;`, [
        first.member_id,
      ]);
      expect(stillActive.rows[0].status).toBe("active");

      // The old code no longer works for a new registrant.
      const otherUserId = await createUser(db, "other@example.com");
      const oldCodeAttempt = await register(db, otherUserId, "parent", "Other", "original");
      expect(oldCodeAttempt.outcome).toBe("wrong_code");
    });

    it("the stored join code hash is not the plain code, and crypt(code, hash) = hash", async () => {
      await setJoinCode(db, adminUserId, "supersecret");

      const row = await db.query<{ join_code_hash: string }>(`select join_code_hash from app_setting;`);
      const hash = row.rows[0].join_code_hash;
      expect(hash).not.toBe("supersecret");

      const matches = await db.query<{ ok: boolean }>(
        `select (extensions.crypt('supersecret', $1) = $1) as ok;`,
        [hash],
      );
      expect(matches.rows[0].ok).toBe(true);
    });

    it("clearing the join code makes new registrations wait", async () => {
      await setJoinCode(db, adminUserId, "clearme1");
      await setJoinCode(db, adminUserId, null);

      const userId = await createUser(db, "aftercleared@example.com");
      const row = await register(db, userId, "parent", "AfterCleared", "clearme1");
      expect(row.outcome).toBe("waiting");
    });

    it("empty name is refused (invalid_name)", async () => {
      const userId = await createUser(db, "noname@example.com");
      await expect(register(db, userId, "parent", "   ", null)).rejects.toThrow("invalid_name");
    });

    it("invalid role is refused (invalid_role)", async () => {
      const userId = await createUser(db, "badrole@example.com");
      await expect(register(db, userId, "grandparent", "X", null)).rejects.toThrow("invalid_role");
    });

    it("registering twice is refused (already_registered)", async () => {
      const userId = await createUser(db, "twice@example.com");
      await register(db, userId, "parent", "Once", null);
      await expect(register(db, userId, "parent", "Twice", null)).rejects.toThrow("already_registered");
    });

    it("admin cannot register (admin_cannot_register)", async () => {
      await expect(register(db, adminUserId, "parent", "Admin", null)).rejects.toThrow(
        "admin_cannot_register",
      );
    });

    it("anon cannot call register", async () => {
      await expect(
        asAnon(db, (tx) => tx.query(`select * from register($1, $2, $3);`, ["parent", "X", null])),
      ).rejects.toThrow();
    });
  });

  // -- admin account management ---------------------------------------------

  describe("admin account management", () => {
    it("non-admin cannot call set_join_code", async () => {
      const userId = await createUser(db, "notadmin1@example.com");
      await insertMember(db, userId, "NotAdmin", "parent", "active");
      await expect(
        asUser(db, userId, (tx) => tx.query(`select set_join_code($1);`, ["whatever"])),
      ).rejects.toThrow("not_admin");
    });

    it("non-admin cannot call any admin-only function", async () => {
      const userId = await createUser(db, "notadmin2@example.com");
      const memberId = await insertMember(db, userId, "NotAdmin", "parent", "waiting");

      await expect(
        asUser(db, userId, (tx) => tx.query(`select approve_member($1);`, [memberId])),
      ).rejects.toThrow("not_admin");
      await expect(
        asUser(db, userId, (tx) => tx.query(`select decline_member($1);`, [memberId])),
      ).rejects.toThrow("not_admin");
      await expect(
        asUser(db, userId, (tx) => tx.query(`select deactivate_member($1);`, [memberId])),
      ).rejects.toThrow("not_admin");
      await expect(
        asUser(db, userId, (tx) => tx.query(`select reactivate_member($1);`, [memberId])),
      ).rejects.toThrow("not_admin");
      await expect(
        asUser(db, userId, (tx) => tx.query(`select set_member_role($1, $2);`, [memberId, "host"])),
      ).rejects.toThrow("not_admin");
      await expect(
        asUser(db, userId, (tx) => tx.query(`select * from admin_accounts();`)),
      ).rejects.toThrow("not_admin");
    });

    it("approve_member moves waiting to active", async () => {
      const userId = await createUser(db, "waitingapprove@example.com");
      const memberId = await insertMember(db, userId, "Waiting", "parent", "waiting");

      await asUser(db, adminUserId, (tx) => tx.query(`select approve_member($1);`, [memberId]));

      const row = await db.query<{ status: string }>(`select status from member where id = $1;`, [
        memberId,
      ]);
      expect(row.rows[0].status).toBe("active");
    });

    it("decline_member moves waiting to deactivated", async () => {
      const userId = await createUser(db, "waitingdecline@example.com");
      const memberId = await insertMember(db, userId, "Waiting", "parent", "waiting");

      await asUser(db, adminUserId, (tx) => tx.query(`select decline_member($1);`, [memberId]));

      const row = await db.query<{ status: string }>(`select status from member where id = $1;`, [
        memberId,
      ]);
      expect(row.rows[0].status).toBe("deactivated");
    });

    it("deactivate_member moves active to deactivated", async () => {
      const userId = await createUser(db, "activedeactivate@example.com");
      const memberId = await insertMember(db, userId, "Active", "host", "active");

      await asUser(db, adminUserId, (tx) => tx.query(`select deactivate_member($1);`, [memberId]));

      const row = await db.query<{ status: string }>(`select status from member where id = $1;`, [
        memberId,
      ]);
      expect(row.rows[0].status).toBe("deactivated");
    });

    it("reactivate_member moves deactivated to active, restoring exactly the access the role/links give", async () => {
      const userId = await createUser(db, "reactivate@example.com");
      const memberId = await insertMember(db, userId, "Deactivated", "host", "deactivated");

      // While deactivated, sees nothing.
      const before = await asUser(db, userId, (tx) => tx.query(`select * from member;`));
      expect(before.rows).toHaveLength(0);

      await asUser(db, adminUserId, (tx) => tx.query(`select reactivate_member($1);`, [memberId]));

      const row = await db.query<{ status: string }>(`select status from member where id = $1;`, [
        memberId,
      ]);
      expect(row.rows[0].status).toBe("active");

      // Now sees (at least) itself.
      const after = await asUser(db, userId, (tx) => tx.query<{ id: string }>(`select id from member;`));
      expect(after.rows.map((r) => r.id)).toContain(memberId);
    });

    it("an out-of-order transition is refused (invalid_status_transition)", async () => {
      const userId = await createUser(db, "alreadyactive@example.com");
      const memberId = await insertMember(db, userId, "Active", "parent", "active");

      // approve_member only accepts waiting -> active.
      await expect(
        asUser(db, adminUserId, (tx) => tx.query(`select approve_member($1);`, [memberId])),
      ).rejects.toThrow("invalid_status_transition");
    });

    it("a nonexistent member id is refused (not_found)", async () => {
      await expect(
        asUser(db, adminUserId, (tx) =>
          tx.query(`select approve_member($1);`, ["00000000-0000-0000-0000-000000000000"]),
        ),
      ).rejects.toThrow("not_found");
    });

    it("set_member_role is refused while the account has links (role_change_has_links)", async () => {
      const userId = await createUser(db, "linkedparent@example.com");
      const memberId = await insertMember(db, userId, "Linked", "parent", "active");
      const childResult = await db.query<{ id: string }>(
        `insert into child (name, created_by) values ('Kid', $1) returning id;`,
        [memberId],
      );
      await db.query(`insert into guardian (member_id, child_id) values ($1, $2);`, [
        memberId,
        childResult.rows[0].id,
      ]);

      await expect(
        asUser(db, adminUserId, (tx) => tx.query(`select set_member_role($1, $2);`, [memberId, "host"])),
      ).rejects.toThrow("role_change_has_links");
    });

    it("set_member_role succeeds once the account is unlinked", async () => {
      const userId = await createUser(db, "unlinkedhost@example.com");
      const memberId = await insertMember(db, userId, "Unlinked", "host", "active");

      await asUser(db, adminUserId, (tx) => tx.query(`select set_member_role($1, $2);`, [memberId, "parent"]));

      const row = await db.query<{ role: string }>(`select role from member where id = $1;`, [memberId]);
      expect(row.rows[0].role).toBe("parent");
    });

    it("anon cannot call any admin function", async () => {
      const dummyId = "00000000-0000-0000-0000-000000000000";
      await expect(asAnon(db, (tx) => tx.query(`select set_join_code($1);`, ["x"]))).rejects.toThrow();
      await expect(asAnon(db, (tx) => tx.query(`select approve_member($1);`, [dummyId]))).rejects.toThrow();
      await expect(asAnon(db, (tx) => tx.query(`select decline_member($1);`, [dummyId]))).rejects.toThrow();
      await expect(
        asAnon(db, (tx) => tx.query(`select deactivate_member($1);`, [dummyId])),
      ).rejects.toThrow();
      await expect(
        asAnon(db, (tx) => tx.query(`select reactivate_member($1);`, [dummyId])),
      ).rejects.toThrow();
      await expect(
        asAnon(db, (tx) => tx.query(`select set_member_role($1, $2);`, [dummyId, "parent"])),
      ).rejects.toThrow();
      await expect(asAnon(db, (tx) => tx.query(`select * from admin_accounts();`))).rejects.toThrow();
    });
  });

  // -- my_account / member_emails / admin_accounts --------------------------

  describe("my_account / member_emails / admin_accounts", () => {
    it("my_account for an unregistered signed-in identity: one row, member fields null", async () => {
      const userId = await createUser(db, "unregistered@example.com");
      const account = await myAccount(db, userId);
      expect(account.member_id).toBeNull();
      expect(account.name).toBeNull();
      expect(account.role).toBeNull();
      expect(account.status).toBeNull();
      expect(account.email).toBe("unregistered@example.com");
      expect(account.is_admin).toBe(false);
      expect(account.code_attempts_left).toBe(5);
    });

    it("my_account for a waiting member", async () => {
      const userId = await createUser(db, "waitingaccount@example.com");
      const memberId = await insertMember(db, userId, "Waiter", "parent", "waiting");
      const account = await myAccount(db, userId);
      expect(account.member_id).toBe(memberId);
      expect(account.status).toBe("waiting");
      expect(account.is_admin).toBe(false);
    });

    it("my_account for an active member", async () => {
      const userId = await createUser(db, "activeaccount@example.com");
      const memberId = await insertMember(db, userId, "Actor", "host", "active");
      const account = await myAccount(db, userId);
      expect(account.member_id).toBe(memberId);
      expect(account.status).toBe("active");
      expect(account.role).toBe("host");
    });

    it("my_account for the admin: no member row, is_admin true", async () => {
      const account = await myAccount(db, adminUserId);
      expect(account.member_id).toBeNull();
      expect(account.is_admin).toBe(true);
      expect(account.email).toBe("admin@example.com");
    });

    it("my_account reflects the attempt counter", async () => {
      await setJoinCode(db, adminUserId, "codehere");
      const userId = await createUser(db, "counterreflect@example.com");
      await register(db, userId, "parent", "X", "wrong1");
      await register(db, userId, "parent", "X", "wrong2");

      const account = await myAccount(db, userId);
      expect(account.code_attempts_left).toBe(3);
    });

    it("member_emails never returns emails of unrelated members", async () => {
      const p1UserId = await createUser(db, "p1emails@example.com");
      const p1Id = await insertMember(db, p1UserId, "P1", "parent", "active");
      const p2UserId = await createUser(db, "p2emails@example.com");
      const p2Id = await insertMember(db, p2UserId, "P2", "parent", "active");
      const strangerUserId = await createUser(db, "strangeremails@example.com");
      await insertMember(db, strangerUserId, "Stranger", "parent", "active");

      const childResult = await db.query<{ id: string }>(
        `insert into child (name, created_by) values ('Kid', $1) returning id;`,
        [p1Id],
      );
      await db.query(`insert into guardian (member_id, child_id) values ($1, $3), ($2, $3);`, [
        p1Id,
        p2Id,
        childResult.rows[0].id,
      ]);

      const seenByP1 = await asUser(db, p1UserId, (tx) =>
        tx.query<{ member_id: string; email: string }>(`select * from member_emails();`),
      );
      const emails = seenByP1.rows.map((r) => r.email).sort();
      expect(emails).toEqual(["p1emails@example.com", "p2emails@example.com"]);
      expect(emails).not.toContain("strangeremails@example.com");
    });

    it("member_emails returns nothing for a non-active, non-admin caller", async () => {
      const userId = await createUser(db, "waitingemails@example.com");
      await insertMember(db, userId, "Waiting", "parent", "waiting");

      const result = await asUser(db, userId, (tx) => tx.query(`select * from member_emails();`));
      expect(result.rows).toHaveLength(0);
    });

    it("admin_accounts lists every account with its links, for the admin", async () => {
      const userId = await createUser(db, "listed@example.com");
      const memberId = await insertMember(db, userId, "Listed", "parent", "active");
      const childResult = await db.query<{ id: string }>(
        `insert into child (name, created_by) values ('Kid', $1) returning id;`,
        [memberId],
      );
      await db.query(`insert into guardian (member_id, child_id) values ($1, $2);`, [
        memberId,
        childResult.rows[0].id,
      ]);

      const rows = await asUser(db, adminUserId, (tx) =>
        tx.query<{ member_id: string; email: string; child_ids: string[] }>(
          `select * from admin_accounts();`,
        ),
      );
      const row = rows.rows.find((r) => r.member_id === memberId);
      expect(row).toBeDefined();
      expect(row?.email).toBe("listed@example.com");
      expect(row?.child_ids).toEqual([childResult.rows[0].id]);
    });
  });

  // -- children ---------------------------------------------------------

  describe("children", () => {
    it("add_child: active parent becomes the child's guardian", async () => {
      const userId = await createUser(db, "addchildparent@example.com");
      const memberId = await insertMember(db, userId, "Parent", "parent", "active");

      const result = await asUser(db, userId, (tx) =>
        tx.query<{ add_child: string }>(`select add_child($1) as add_child;`, ["Lyanne"]),
      );
      const childId = result.rows[0].add_child;
      expect(childId).toBeTruthy();

      const link = await db.query(`select 1 from guardian where member_id = $1 and child_id = $2;`, [
        memberId,
        childId,
      ]);
      expect(link.rows).toHaveLength(1);
    });

    it("host cannot add a child (not_parent)", async () => {
      const userId = await createUser(db, "hostnochild@example.com");
      await insertMember(db, userId, "Host", "host", "active");

      await expect(
        asUser(db, userId, (tx) => tx.query(`select add_child($1);`, ["Kid"])),
      ).rejects.toThrow("not_parent");
    });

    it("a waiting parent cannot add a child (not_active)", async () => {
      const userId = await createUser(db, "waitingparentchild@example.com");
      await insertMember(db, userId, "Waiting", "parent", "waiting");

      await expect(
        asUser(db, userId, (tx) => tx.query(`select add_child($1);`, ["Kid"])),
      ).rejects.toThrow("not_active");
    });

    it("add_child with an empty name is refused (invalid_name)", async () => {
      const userId = await createUser(db, "emptychildname@example.com");
      await insertMember(db, userId, "Parent", "parent", "active");

      await expect(asUser(db, userId, (tx) => tx.query(`select add_child($1);`, ["   "]))).rejects.toThrow(
        "invalid_name",
      );
    });

    it("rename_child by a guardian succeeds", async () => {
      const userId = await createUser(db, "renamerparent@example.com");
      const memberId = await insertMember(db, userId, "Parent", "parent", "active");
      const childId = await addChild(db, memberId, "Old Name");

      await asUser(db, userId, (tx) => tx.query(`select rename_child($1, $2);`, [childId, "New Name"]));

      const row = await db.query<{ name: string }>(`select name from child where id = $1;`, [childId]);
      expect(row.rows[0].name).toBe("New Name");
    });

    it("rename_child by the admin succeeds", async () => {
      const userId = await createUser(db, "renamedbyadmin@example.com");
      const memberId = await insertMember(db, userId, "Parent", "parent", "active");
      const childId = await addChild(db, memberId, "Old Name");

      await asUser(db, adminUserId, (tx) =>
        tx.query(`select rename_child($1, $2);`, [childId, "Admin Renamed"]),
      );

      const row = await db.query<{ name: string }>(`select name from child where id = $1;`, [childId]);
      expect(row.rows[0].name).toBe("Admin Renamed");
    });

    it("rename_child by someone who is not the child's guardian is refused (not_guardian_of_child)", async () => {
      const ownerUserId = await createUser(db, "childowner@example.com");
      const ownerId = await insertMember(db, ownerUserId, "Owner", "parent", "active");
      const childId = await addChild(db, ownerId, "Kid");

      const otherUserId = await createUser(db, "notguardian@example.com");
      await insertMember(db, otherUserId, "Other", "parent", "active");

      await expect(
        asUser(db, otherUserId, (tx) => tx.query(`select rename_child($1, $2);`, [childId, "Hijacked"])),
      ).rejects.toThrow("not_guardian_of_child");
    });

    it("add_guardian links a registered active parent by email, case-insensitive", async () => {
      const p1UserId = await createUser(db, "coparent1@example.com");
      const p1Id = await insertMember(db, p1UserId, "P1", "parent", "active");
      const childId = await addChild(db, p1Id, "Kid");

      const p2UserId = await createUser(db, "CoParent2@Example.com");
      const p2Id = await insertMember(db, p2UserId, "P2", "parent", "active");

      await asUser(db, p1UserId, (tx) =>
        tx.query(`select add_guardian($1, $2);`, [childId, "coparent2@example.com"]),
      );

      const link = await db.query(`select 1 from guardian where member_id = $1 and child_id = $2;`, [
        p2Id,
        childId,
      ]);
      expect(link.rows).toHaveLength(1);
    });

    it("add_guardian is idempotent when the co-parent is already linked", async () => {
      const p1UserId = await createUser(db, "idempotentp1@example.com");
      const p1Id = await insertMember(db, p1UserId, "P1", "parent", "active");
      const childId = await addChild(db, p1Id, "Kid");

      const p2UserId = await createUser(db, "idempotentp2@example.com");
      await insertMember(db, p2UserId, "P2", "parent", "active");

      await asUser(db, p1UserId, (tx) =>
        tx.query(`select add_guardian($1, $2);`, [childId, "idempotentp2@example.com"]),
      );
      // Second call: no error, no duplicate row (would violate the PK
      // otherwise — on conflict do nothing handles it).
      await asUser(db, p1UserId, (tx) =>
        tx.query(`select add_guardian($1, $2);`, [childId, "idempotentp2@example.com"]),
      );

      const count = await db.query<{ n: string }>(
        `select count(*)::int as n from guardian where child_id = $1;`,
        [childId],
      );
      expect(Number(count.rows[0].n)).toBe(2);
    });

    it.each([
      ["an email with no account", "nowhere@example.com"],
      ["a host account's email", "hostemail@example.com"],
      ["a waiting parent account's email", "waitingparentemail@example.com"],
    ])("add_guardian refuses %s (no_parent_account)", async (_label, email) => {
      const p1UserId = await createUser(db, "refuseco@example.com");
      const p1Id = await insertMember(db, p1UserId, "P1", "parent", "active");
      const childId = await addChild(db, p1Id, "Kid");

      if (email === "hostemail@example.com") {
        const hostUserId = await createUser(db, email);
        await insertMember(db, hostUserId, "Host", "host", "active");
      } else if (email === "waitingparentemail@example.com") {
        const waitingUserId = await createUser(db, email);
        await insertMember(db, waitingUserId, "Waiting", "parent", "waiting");
      }

      await expect(
        asUser(db, p1UserId, (tx) => tx.query(`select add_guardian($1, $2);`, [childId, email])),
      ).rejects.toThrow("no_parent_account");
    });

    it("add_guardian is refused for someone who is not a guardian of the child", async () => {
      const ownerUserId = await createUser(db, "childowner2@example.com");
      const ownerId = await insertMember(db, ownerUserId, "Owner", "parent", "active");
      const childId = await addChild(db, ownerId, "Kid");

      const strangerUserId = await createUser(db, "linkstranger@example.com");
      await insertMember(db, strangerUserId, "Stranger", "parent", "active");

      const targetUserId = await createUser(db, "linktarget@example.com");
      await insertMember(db, targetUserId, "Target", "parent", "active");

      await expect(
        asUser(db, strangerUserId, (tx) =>
          tx.query(`select add_guardian($1, $2);`, [childId, "linktarget@example.com"]),
        ),
      ).rejects.toThrow("not_guardian_of_child");
    });

    it("remove_guardian: happy path removes a co-parent when another remains", async () => {
      const p1UserId = await createUser(db, "removeco1@example.com");
      const p1Id = await insertMember(db, p1UserId, "P1", "parent", "active");
      const childId = await addChild(db, p1Id, "Kid");

      const p2UserId = await createUser(db, "removeco2@example.com");
      const p2Id = await insertMember(db, p2UserId, "P2", "parent", "active");
      await db.query(`insert into guardian (member_id, child_id) values ($1, $2);`, [p2Id, childId]);

      await asUser(db, p1UserId, (tx) => tx.query(`select remove_guardian($1, $2);`, [childId, p2Id]));

      const link = await db.query(`select 1 from guardian where member_id = $1 and child_id = $2;`, [
        p2Id,
        childId,
      ]);
      expect(link.rows).toHaveLength(0);
    });

    it("removing a child's last parent is refused (last_parent)", async () => {
      const p1UserId = await createUser(db, "lastparent@example.com");
      const p1Id = await insertMember(db, p1UserId, "P1", "parent", "active");
      const childId = await addChild(db, p1Id, "Kid");

      await expect(
        asUser(db, p1UserId, (tx) => tx.query(`select remove_guardian($1, $2);`, [childId, p1Id])),
      ).rejects.toThrow("last_parent");
    });

    it("anon cannot call any child function", async () => {
      const dummyId = "00000000-0000-0000-0000-000000000000";
      await expect(asAnon(db, (tx) => tx.query(`select add_child($1);`, ["X"]))).rejects.toThrow();
      await expect(
        asAnon(db, (tx) => tx.query(`select rename_child($1, $2);`, [dummyId, "X"])),
      ).rejects.toThrow();
      await expect(
        asAnon(db, (tx) => tx.query(`select add_guardian($1, $2);`, [dummyId, "x@example.com"])),
      ).rejects.toThrow();
      await expect(
        asAnon(db, (tx) => tx.query(`select remove_guardian($1, $2);`, [dummyId, dummyId])),
      ).rejects.toThrow();
    });
  });

  // -- places -------------------------------------------------------------

  describe("places", () => {
    it("add_place: active host becomes the place's host", async () => {
      const userId = await createUser(db, "addplacehost@example.com");
      const memberId = await insertMember(db, userId, "Host", "host", "active");

      const result = await asUser(db, userId, (tx) =>
        tx.query<{ add_place: string }>(`select add_place($1, $2, $3) as add_place;`, [
          "Grandma & Grandpa's",
          "1 Example St",
          "Asia/Singapore",
        ]),
      );
      const placeId = result.rows[0].add_place;
      expect(placeId).toBeTruthy();

      const link = await db.query(`select 1 from place_host where member_id = $1 and place_id = $2;`, [
        memberId,
        placeId,
      ]);
      expect(link.rows).toHaveLength(1);
    });

    it("parent cannot add a place (not_host)", async () => {
      const userId = await createUser(db, "parentnoplace@example.com");
      await insertMember(db, userId, "Parent", "parent", "active");

      await expect(
        asUser(db, userId, (tx) =>
          tx.query(`select add_place($1, $2, $3);`, ["Home", null, "Asia/Tokyo"]),
        ),
      ).rejects.toThrow("not_host");
    });

    it("add_place with an unknown time zone is refused (invalid_time_zone)", async () => {
      const userId = await createUser(db, "badtzhost@example.com");
      await insertMember(db, userId, "Host", "host", "active");

      await expect(
        asUser(db, userId, (tx) =>
          tx.query(`select add_place($1, $2, $3);`, ["Home", null, "Not/AZone"]),
        ),
      ).rejects.toThrow("invalid_time_zone");
    });

    it("add_place trims a blank address to null", async () => {
      const userId = await createUser(db, "blankaddresshost@example.com");
      await insertMember(db, userId, "Host", "host", "active");

      const result = await asUser(db, userId, (tx) =>
        tx.query<{ add_place: string }>(`select add_place($1, $2, $3) as add_place;`, [
          "Home",
          "   ",
          "Asia/Tokyo",
        ]),
      );
      const row = await db.query<{ address: string | null }>(`select address from place where id = $1;`, [
        result.rows[0].add_place,
      ]);
      expect(row.rows[0].address).toBeNull();
    });

    it("update_place by a host of the place succeeds", async () => {
      const userId = await createUser(db, "updateplacehost@example.com");
      const memberId = await insertMember(db, userId, "Host", "host", "active");
      const placeId = await addPlace(db, memberId, "Old Name", null, "Asia/Tokyo");

      await asUser(db, userId, (tx) =>
        tx.query(`select update_place($1, $2, $3, $4);`, [placeId, "New Name", "New Address", "Asia/Seoul"]),
      );

      const row = await db.query<{ name: string; address: string | null; time_zone: string }>(
        `select name, address, time_zone from place where id = $1;`,
        [placeId],
      );
      expect(row.rows[0]).toEqual({ name: "New Name", address: "New Address", time_zone: "Asia/Seoul" });
    });

    it("update_place by the admin succeeds", async () => {
      const userId = await createUser(db, "updatebyadmin@example.com");
      const memberId = await insertMember(db, userId, "Host", "host", "active");
      const placeId = await addPlace(db, memberId, "Old Name", null, "Asia/Tokyo");

      await asUser(db, adminUserId, (tx) =>
        tx.query(`select update_place($1, $2, $3, $4);`, [placeId, "Admin Name", null, "Asia/Tokyo"]),
      );

      const row = await db.query<{ name: string }>(`select name from place where id = $1;`, [placeId]);
      expect(row.rows[0].name).toBe("Admin Name");
    });

    it("update_place by someone who is not a host of that place is refused (not_host_of_place)", async () => {
      const ownerUserId = await createUser(db, "placeowner@example.com");
      const ownerId = await insertMember(db, ownerUserId, "Owner", "host", "active");
      const placeId = await addPlace(db, ownerId, "Home", null, "Asia/Tokyo");

      const otherHostUserId = await createUser(db, "otherhost@example.com");
      await insertMember(db, otherHostUserId, "OtherHost", "host", "active");

      await expect(
        asUser(db, otherHostUserId, (tx) =>
          tx.query(`select update_place($1, $2, $3, $4);`, [placeId, "Hijacked", null, "Asia/Tokyo"]),
        ),
      ).rejects.toThrow("not_host_of_place");
    });

    it("add_host links a registered active host by email, case-insensitive", async () => {
      const h1UserId = await createUser(db, "cohost1@example.com");
      const h1Id = await insertMember(db, h1UserId, "H1", "host", "active");
      const placeId = await addPlace(db, h1Id, "Home", null, "Asia/Tokyo");

      const h2UserId = await createUser(db, "CoHost2@Example.com");
      const h2Id = await insertMember(db, h2UserId, "H2", "host", "active");

      await asUser(db, h1UserId, (tx) =>
        tx.query(`select add_host($1, $2);`, [placeId, "cohost2@example.com"]),
      );

      const link = await db.query(`select 1 from place_host where member_id = $1 and place_id = $2;`, [
        h2Id,
        placeId,
      ]);
      expect(link.rows).toHaveLength(1);
    });

    it.each([
      ["an email with no account", "nowherehost@example.com"],
      ["a parent account's email", "parentemailforhost@example.com"],
      ["a waiting host account's email", "waitinghostemail@example.com"],
    ])("add_host refuses %s (no_host_account)", async (_label, email) => {
      const h1UserId = await createUser(db, "refusehost@example.com");
      const h1Id = await insertMember(db, h1UserId, "H1", "host", "active");
      const placeId = await addPlace(db, h1Id, "Home", null, "Asia/Tokyo");

      if (email === "parentemailforhost@example.com") {
        const parentUserId = await createUser(db, email);
        await insertMember(db, parentUserId, "Parent", "parent", "active");
      } else if (email === "waitinghostemail@example.com") {
        const waitingUserId = await createUser(db, email);
        await insertMember(db, waitingUserId, "Waiting", "host", "waiting");
      }

      await expect(
        asUser(db, h1UserId, (tx) => tx.query(`select add_host($1, $2);`, [placeId, email])),
      ).rejects.toThrow("no_host_account");
    });

    it("removing a place's last host is refused (last_host)", async () => {
      const h1UserId = await createUser(db, "lasthost@example.com");
      const h1Id = await insertMember(db, h1UserId, "H1", "host", "active");
      const placeId = await addPlace(db, h1Id, "Home", null, "Asia/Tokyo");

      await expect(
        asUser(db, h1UserId, (tx) => tx.query(`select remove_host($1, $2);`, [placeId, h1Id])),
      ).rejects.toThrow("last_host");
    });

    it("remove_host: happy path removes a co-host when another remains", async () => {
      const h1UserId = await createUser(db, "removehost1@example.com");
      const h1Id = await insertMember(db, h1UserId, "H1", "host", "active");
      const placeId = await addPlace(db, h1Id, "Home", null, "Asia/Tokyo");

      const h2UserId = await createUser(db, "removehost2@example.com");
      const h2Id = await insertMember(db, h2UserId, "H2", "host", "active");
      await db.query(`insert into place_host (member_id, place_id) values ($1, $2);`, [h2Id, placeId]);

      await asUser(db, h1UserId, (tx) => tx.query(`select remove_host($1, $2);`, [placeId, h2Id]));

      const link = await db.query(`select 1 from place_host where member_id = $1 and place_id = $2;`, [
        h2Id,
        placeId,
      ]);
      expect(link.rows).toHaveLength(0);
    });

    it("anon cannot call any place function", async () => {
      const dummyId = "00000000-0000-0000-0000-000000000000";
      await expect(
        asAnon(db, (tx) => tx.query(`select add_place($1, $2, $3);`, ["X", null, "Asia/Tokyo"])),
      ).rejects.toThrow();
      await expect(
        asAnon(db, (tx) => tx.query(`select update_place($1, $2, $3, $4);`, [dummyId, "X", null, "Asia/Tokyo"])),
      ).rejects.toThrow();
      await expect(
        asAnon(db, (tx) => tx.query(`select add_host($1, $2);`, [dummyId, "x@example.com"])),
      ).rejects.toThrow();
      await expect(
        asAnon(db, (tx) => tx.query(`select remove_host($1, $2);`, [dummyId, dummyId])),
      ).rejects.toThrow();
    });
  });

  // -- admin linking --------------------------------------------------------

  describe("admin-by-id linking", () => {
    it("admin_set_guardian links a parent to a child", async () => {
      const ownerUserId = await createUser(db, "adminlinkowner@example.com");
      const ownerId = await insertMember(db, ownerUserId, "Owner", "parent", "active");
      const childId = await addChild(db, ownerId, "Kid");

      const targetUserId = await createUser(db, "adminlinktarget@example.com");
      const targetId = await insertMember(db, targetUserId, "Target", "parent", "active");

      await asUser(db, adminUserId, (tx) =>
        tx.query(`select admin_set_guardian($1, $2, $3);`, [childId, targetId, true]),
      );

      const link = await db.query(`select 1 from guardian where member_id = $1 and child_id = $2;`, [
        targetId,
        childId,
      ]);
      expect(link.rows).toHaveLength(1);
    });

    it("admin cannot link a host account as a child's parent (link_role_mismatch)", async () => {
      const ownerUserId = await createUser(db, "adminlinkowner2@example.com");
      const ownerId = await insertMember(db, ownerUserId, "Owner", "parent", "active");
      const childId = await addChild(db, ownerId, "Kid");

      const hostUserId = await createUser(db, "adminlinkhost@example.com");
      const hostId = await insertMember(db, hostUserId, "Host", "host", "active");

      await expect(
        asUser(db, adminUserId, (tx) =>
          tx.query(`select admin_set_guardian($1, $2, $3);`, [childId, hostId, true]),
        ),
      ).rejects.toThrow("link_role_mismatch");
    });

    it("admin_set_guardian unlink still respects last_parent", async () => {
      const ownerUserId = await createUser(db, "adminunlinklast@example.com");
      const ownerId = await insertMember(db, ownerUserId, "Owner", "parent", "active");
      const childId = await addChild(db, ownerId, "Kid");

      await expect(
        asUser(db, adminUserId, (tx) =>
          tx.query(`select admin_set_guardian($1, $2, $3);`, [childId, ownerId, false]),
        ),
      ).rejects.toThrow("last_parent");
    });

    it("admin_set_host links a host to a place", async () => {
      const ownerUserId = await createUser(db, "adminhostowner@example.com");
      const ownerId = await insertMember(db, ownerUserId, "Owner", "host", "active");
      const placeId = await addPlace(db, ownerId, "Home", null, "Asia/Tokyo");

      const targetUserId = await createUser(db, "adminhosttarget@example.com");
      const targetId = await insertMember(db, targetUserId, "Target", "host", "active");

      await asUser(db, adminUserId, (tx) =>
        tx.query(`select admin_set_host($1, $2, $3);`, [placeId, targetId, true]),
      );

      const link = await db.query(`select 1 from place_host where member_id = $1 and place_id = $2;`, [
        targetId,
        placeId,
      ]);
      expect(link.rows).toHaveLength(1);
    });

    it("admin cannot link a parent account as a place's host (link_role_mismatch)", async () => {
      const ownerUserId = await createUser(db, "adminhostowner2@example.com");
      const ownerId = await insertMember(db, ownerUserId, "Owner", "host", "active");
      const placeId = await addPlace(db, ownerId, "Home", null, "Asia/Tokyo");

      const parentUserId = await createUser(db, "adminhostparent@example.com");
      const parentId = await insertMember(db, parentUserId, "Parent", "parent", "active");

      await expect(
        asUser(db, adminUserId, (tx) =>
          tx.query(`select admin_set_host($1, $2, $3);`, [placeId, parentId, true]),
        ),
      ).rejects.toThrow("link_role_mismatch");
    });

    it("admin_set_host unlink still respects last_host", async () => {
      const ownerUserId = await createUser(db, "adminunlinklasthost@example.com");
      const ownerId = await insertMember(db, ownerUserId, "Owner", "host", "active");
      const placeId = await addPlace(db, ownerId, "Home", null, "Asia/Tokyo");

      await expect(
        asUser(db, adminUserId, (tx) =>
          tx.query(`select admin_set_host($1, $2, $3);`, [placeId, ownerId, false]),
        ),
      ).rejects.toThrow("last_host");
    });
  });

  // Concurrency: PGlite is a single connection, so there is no second,
  // truly concurrent transaction available to race the `for update` locks
  // in remove_guardian/remove_host/admin_set_guardian/admin_set_host
  // against. Proving those locks hold under real concurrent access is out
  // of scope for these tests (design.md Decision 11) and is not simulated
  // here — it would only assert that PGlite serialises everything, which is
  // true by construction and would not exercise the lock at all.
});

/** Inserts a child directly with a guardian link for `memberId` — the
 * fixture shape add_child produces, without re-testing add_child itself. */
async function addChild(db: PGlite, memberId: string, name: string): Promise<string> {
  const result = await db.query<{ id: string }>(
    `insert into child (name, created_by) values ($1, $2) returning id;`,
    [name, memberId],
  );
  await db.query(`insert into guardian (member_id, child_id) values ($1, $2);`, [memberId, result.rows[0].id]);
  return result.rows[0].id;
}

/** Inserts a place directly with a place_host link for `memberId` — the
 * fixture shape add_place produces, without re-testing add_place itself. */
async function addPlace(
  db: PGlite,
  memberId: string,
  name: string,
  address: string | null,
  timeZone: string,
): Promise<string> {
  const result = await db.query<{ id: string }>(
    `insert into place (name, address, time_zone, created_by) values ($1, $2, $3, $4) returning id;`,
    [name, address, timeZone, memberId],
  );
  await db.query(`insert into place_host (member_id, place_id) values ($1, $2);`, [
    memberId,
    result.rows[0].id,
  ]);
  return result.rows[0].id;
}

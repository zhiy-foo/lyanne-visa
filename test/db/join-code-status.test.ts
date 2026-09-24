import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asAnon, asUser, createTestDb, createUser } from "./harness";

describe("join_code_is_set", () => {
  let db: PGlite;
  let adminUserId: string;
  let parentUserId: string;

  beforeEach(async () => {
    db = await createTestDb();
    adminUserId = await createUser(db, "admin@example.com");
    await db.query(`insert into app_admin (email) values ($1);`, ["admin@example.com"]);

    parentUserId = await createUser(db, "parent@example.com");
    await db.query(
      `insert into member (user_id, name, role, status) values ($1, 'Parent', 'parent', 'active');`,
      [parentUserId],
    );
  });

  afterEach(async () => {
    await db.close();
  });

  it("reports false when no code is set", async () => {
    const result = await asUser(db, adminUserId, (tx) => tx.query<{ join_code_is_set: boolean }>(
      `select join_code_is_set();`,
    ));
    expect(result.rows[0].join_code_is_set).toBe(false);
  });

  it("reports true once the admin sets a code", async () => {
    await asUser(db, adminUserId, (tx) => tx.query(`select set_join_code($1);`, ["letmein"]));

    const result = await asUser(db, adminUserId, (tx) => tx.query<{ join_code_is_set: boolean }>(
      `select join_code_is_set();`,
    ));
    expect(result.rows[0].join_code_is_set).toBe(true);
  });

  it("reports false again once the admin clears the code", async () => {
    await asUser(db, adminUserId, (tx) => tx.query(`select set_join_code($1);`, ["letmein"]));
    await asUser(db, adminUserId, (tx) => tx.query(`select set_join_code($1);`, [null]));

    const result = await asUser(db, adminUserId, (tx) => tx.query<{ join_code_is_set: boolean }>(
      `select join_code_is_set();`,
    ));
    expect(result.rows[0].join_code_is_set).toBe(false);
  });

  it("refuses a non-admin caller", async () => {
    await asUser(db, adminUserId, (tx) => tx.query(`select set_join_code($1);`, ["letmein"]));

    await expect(
      asUser(db, parentUserId, (tx) => tx.query(`select join_code_is_set();`)),
    ).rejects.toThrow("not_admin");
  });

  it("refuses an anonymous (signed-out) caller", async () => {
    await expect(asAnon(db, (tx) => tx.query(`select join_code_is_set();`))).rejects.toThrow();
  });
});

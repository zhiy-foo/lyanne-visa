import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asAnon, asUser, createTestDb, createUser } from "./harness";

describe("PGlite Supabase shim harness", () => {
  let db: PGlite;

  beforeEach(async () => {
    db = await createTestDb();
  });

  afterEach(async () => {
    await db.close();
  });

  it("auth.uid() returns the caller's id inside asUser", async () => {
    const userId = await createUser(db, "alice@example.com");

    const result = await asUser(db, userId, async (tx) => {
      return tx.query<{ uid: string | null }>(`select auth.uid() as uid;`);
    });

    expect(result.rows[0].uid).toBe(userId);
  });

  it("auth.uid() returns null inside asAnon", async () => {
    const result = await asAnon(db, async (tx) => {
      return tx.query<{ uid: string | null }>(`select auth.uid() as uid;`);
    });

    expect(result.rows[0].uid).toBeNull();
  });

  it("an RLS policy using owner = auth.uid() shows each user only their own rows", async () => {
    const aliceId = await createUser(db, "alice-rls@example.com");
    const bobId = await createUser(db, "bob-rls@example.com");

    // Schema setup runs as the PGlite superuser (as migrations do), not as
    // service_role: real Supabase tables are created by migrations, and
    // service_role has no CREATE on schema public either.
    await db.exec(`
      create table if not exists rls_demo (
        id uuid primary key default gen_random_uuid(),
        owner uuid not null,
        note text not null
      );
      alter table rls_demo enable row level security;
      grant select, insert on rls_demo to authenticated;
      drop policy if exists rls_demo_owner_select on rls_demo;
      create policy rls_demo_owner_select on rls_demo
        for select
        using (owner = auth.uid());
    `);
    await db.query(`insert into rls_demo (owner, note) values ($1, 'alice note');`, [aliceId]);
    await db.query(`insert into rls_demo (owner, note) values ($1, 'bob note');`, [bobId]);

    const aliceRows = await asUser(db, aliceId, async (tx) => {
      return tx.query<{ note: string }>(`select note from rls_demo;`);
    });
    expect(aliceRows.rows).toHaveLength(1);
    expect(aliceRows.rows[0].note).toBe("alice note");

    const bobRows = await asUser(db, bobId, async (tx) => {
      return tx.query<{ note: string }>(`select note from rls_demo;`);
    });
    expect(bobRows.rows).toHaveLength(1);
    expect(bobRows.rows[0].note).toBe("bob note");
  });

  it("authenticated cannot select from auth.users", async () => {
    const userId = await createUser(db, "carol@example.com");

    await expect(
      asUser(db, userId, async (tx) => {
        return tx.query(`select * from auth.users;`);
      }),
    ).rejects.toThrow();
  });

  it("anon cannot select from auth.users either", async () => {
    await expect(
      asAnon(db, async (tx) => {
        return tx.query(`select * from auth.users;`);
      }),
    ).rejects.toThrow();
  });

  it("a table with no revokes and no RLS is insertable and selectable by authenticated and anon by default", async () => {
    // Mirrors real Supabase's default privileges: tables created in `public`
    // are granted ALL to anon/authenticated/service_role unless a migration
    // explicitly revokes it. Runs on a DB WITHOUT migrations applied: the
    // foundation visibility migration deliberately locks default privileges
    // down for future objects too (Fix 2), which would otherwise mask what
    // the shim alone provides. No grant/revoke statements here at all.
    const bareDb = await createTestDb({ migrations: false });
    try {
      await bareDb.exec(`
        create table if not exists open_by_default (
          id uuid primary key default gen_random_uuid(),
          note text not null
        );
      `);

      const authedId = await createUser(bareDb, "open-default-authed@example.com");

      const inserted = await asUser(bareDb, authedId, async (tx) => {
        return tx.query<{ note: string }>(
          `insert into open_by_default (note) values ('from authenticated') returning note;`,
        );
      });
      expect(inserted.rows[0].note).toBe("from authenticated");

      const seenByAuthed = await asUser(bareDb, authedId, async (tx) => {
        return tx.query<{ note: string }>(`select note from open_by_default;`);
      });
      expect(seenByAuthed.rows).toHaveLength(1);

      const seenByAnon = await asAnon(bareDb, async (tx) => {
        return tx.query<{ note: string }>(`select note from open_by_default;`);
      });
      expect(seenByAnon.rows).toHaveLength(1);

      const insertedByAnon = await asAnon(bareDb, async (tx) => {
        return tx.query<{ note: string }>(
          `insert into open_by_default (note) values ('from anon') returning note;`,
        );
      });
      expect(insertedByAnon.rows[0].note).toBe("from anon");
    } finally {
      await bareDb.close();
    }
  });

  it("pgcrypto crypt()/gen_salt('bf') work, installed into the extensions schema", async () => {
    const result = await db.query<{ matches: boolean }>(
      `select (extensions.crypt('correct horse', hash) = hash) as matches
       from (select extensions.crypt('correct horse', extensions.gen_salt('bf')) as hash) s;`,
    );
    expect(result.rows[0].matches).toBe(true);

    const wrong = await db.query<{ matches: boolean }>(
      `select (extensions.crypt('wrong password', hash) = hash) as matches
       from (select extensions.crypt('correct horse', extensions.gen_salt('bf')) as hash) s;`,
    );
    expect(wrong.rows[0].matches).toBe(false);
  });
});

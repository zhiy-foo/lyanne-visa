import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asAnon, asUser, createTestDb, createUser } from "./harness";

/**
 * keepalive-heartbeat: `keepalive_heartbeat` singleton table and the
 * password-locked `keepalive_ping(token)` function —
 * 20260924001500_keepalive_heartbeat.sql.
 */

const TOKEN = "correct-horse-battery-staple";
const WRONG = "wrong-token-value";

interface Ping {
  last_ping_at: Date;
  previous_ping_at: Date | null;
}

interface Heartbeat {
  last_ping_at: Date | null;
  previous_ping_at: Date | null;
  ping_count: string | number | bigint;
  token_sha256: string | null;
}

async function setHash(db: PGlite, token: string | null): Promise<void> {
  if (token === null) {
    await db.query(`update public.keepalive_heartbeat set token_sha256 = null where id = 1;`);
    return;
  }
  await db.query(
    `update public.keepalive_heartbeat set token_sha256 = encode(sha256(convert_to($1, 'UTF8')), 'hex') where id = 1;`,
    [token],
  );
}

async function ping(db: PGlite, token: string | null): Promise<Ping> {
  const result = await asAnon(db, (tx) =>
    tx.query<Ping>(`select * from public.keepalive_ping($1);`, [token]),
  );
  return result.rows[0];
}

async function row(db: PGlite): Promise<Heartbeat> {
  const result = await db.query<Heartbeat>(`select * from public.keepalive_heartbeat;`);
  return result.rows[0];
}

describe("keepalive heartbeat", () => {
  let db: PGlite;

  beforeEach(async () => {
    db = await createTestDb();
  });

  afterEach(async () => {
    await db.close();
  });

  it("seeds exactly one row with null times, count 0 and a null hash", async () => {
    const all = await db.query<Heartbeat>(`select * from public.keepalive_heartbeat;`);
    expect(all.rows).toHaveLength(1);
    const r = all.rows[0];
    expect(r.last_ping_at).toBeNull();
    expect(r.previous_ping_at).toBeNull();
    expect(Number(r.ping_count)).toBe(0);
    expect(r.token_sha256).toBeNull();
  });

  it("first correct call returns last_ping_at, a null previous_ping_at, and count 1", async () => {
    await setHash(db, TOKEN);
    const first = await ping(db, TOKEN);
    expect(first.last_ping_at).toBeInstanceOf(Date);
    expect(first.previous_ping_at).toBeNull();
    const r = await row(db);
    expect(Number(r.ping_count)).toBe(1);
    expect(r.last_ping_at?.getTime()).toBe(first.last_ping_at.getTime());
    expect(r.previous_ping_at).toBeNull();
  });

  it("second call shifts the prior time into previous_ping_at, count 2, still one row", async () => {
    await setHash(db, TOKEN);
    const first = await ping(db, TOKEN);
    await new Promise((resolve) => setTimeout(resolve, 15));
    const second = await ping(db, TOKEN);
    expect(second.previous_ping_at?.getTime()).toBe(first.last_ping_at.getTime());
    expect(second.last_ping_at.getTime()).toBeGreaterThan(first.last_ping_at.getTime());
    const all = await db.query<Heartbeat>(`select * from public.keepalive_heartbeat;`);
    expect(all.rows).toHaveLength(1);
    expect(Number(all.rows[0].ping_count)).toBe(2);
  });

  for (const [label, bad] of [
    ["wrong", WRONG],
    ["null", null],
    ["empty", ""],
  ] as const) {
    it(`a ${label} token is refused with 28000, writes nothing and does not echo the token`, async () => {
      await setHash(db, TOKEN);
      await ping(db, TOKEN);
      const before = await row(db);

      const err = await ping(db, bad).then(
        () => null,
        (e: unknown) => e as { code?: string; message: string },
      );
      expect(err).not.toBeNull();
      expect(err?.code).toBe("28000");
      if (bad) expect(err?.message).not.toContain(bad);

      const after = await row(db);
      expect(after.last_ping_at?.getTime()).toBe(before.last_ping_at?.getTime());
      expect(after.previous_ping_at).toEqual(before.previous_ping_at);
      expect(Number(after.ping_count)).toBe(Number(before.ping_count));
    });
  }

  it("with token_sha256 null every call, even a plausible token, is refused with 28000", async () => {
    await setHash(db, null);
    for (const token of [TOKEN, "plausible-looking-token-0123456789abcdef", "", null]) {
      await expect(ping(db, token)).rejects.toMatchObject({ code: "28000" });
    }
    const r = await row(db);
    expect(r.last_ping_at).toBeNull();
    expect(Number(r.ping_count)).toBe(0);
  });

  it("anon and authenticated cannot select, insert, update or delete the table directly", async () => {
    await setHash(db, TOKEN);
    const userId = await createUser(db, "someone@example.com");
    const statements = [
      `select * from public.keepalive_heartbeat;`,
      `insert into public.keepalive_heartbeat (id) values (1);`,
      `update public.keepalive_heartbeat set ping_count = 99;`,
      `delete from public.keepalive_heartbeat;`,
    ];
    for (const sql of statements) {
      await expect(asAnon(db, (tx) => tx.query(sql))).rejects.toThrow();
      await expect(asUser(db, userId, (tx) => tx.query(sql))).rejects.toThrow();
    }
    const r = await row(db);
    expect(Number(r.ping_count)).toBe(0);
    expect(r.token_sha256).not.toBeNull();
  });

  it("authenticated cannot execute keepalive_ping", async () => {
    await setHash(db, TOKEN);
    const userId = await createUser(db, "someone@example.com");
    await expect(
      asUser(db, userId, (tx) => tx.query(`select * from public.keepalive_ping($1);`, [TOKEN])),
    ).rejects.toThrow(/permission denied/i);
    expect(Number((await row(db)).ping_count)).toBe(0);
  });

  it("rejects a row with id <> 1", async () => {
    await expect(
      db.query(`insert into public.keepalive_heartbeat (id) values (2);`),
    ).rejects.toThrow();
    const all = await db.query(`select 1 from public.keepalive_heartbeat;`);
    expect(all.rows).toHaveLength(1);
  });
});

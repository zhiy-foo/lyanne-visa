import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

export interface CreateTestDbOptions {
  /**
   * Whether to apply the migrations under supabase/migrations after the
   * shim. Defaults to true. Pass `false` to get a bare shimmed database —
   * needed to prove the shim's own (permissive) defaults, since the
   * foundation visibility migration deliberately locks future objects down
   * and would otherwise mask what the shim alone provides.
   */
  migrations?: boolean;
}

/**
 * A fresh PGlite instance with the pgcrypto extension loaded (into the
 * `extensions` schema, matching real Supabase), the Supabase auth shim
 * applied, and — unless disabled — every migration under supabase/migrations
 * applied in filename order.
 */
export async function createTestDb(options: CreateTestDbOptions = {}): Promise<PGlite> {
  const { migrations = true } = options;
  const db = new PGlite({ extensions: { pgcrypto } });

  const shimSql = readFileSync(join(__dirname, "shim.sql"), "utf8");
  await db.exec(shimSql);

  // Real Supabase installs pgcrypto into the `extensions` schema, not
  // `public`; the shim creates that schema, so the extension can be
  // installed into it here, matching every migration's
  // `create extension if not exists pgcrypto with schema extensions;`.
  await db.exec(`create extension if not exists pgcrypto with schema extensions;`);

  if (!migrations) {
    return db;
  }

  const migrationsDir = join(__dirname, "..", "..", "supabase", "migrations");
  let migrationFiles: string[] = [];
  try {
    migrationFiles = readdirSync(migrationsDir)
      .filter((name) => name.endsWith(".sql"))
      .sort();
  } catch {
    // No migrations directory yet — nothing to apply.
    migrationFiles = [];
  }

  for (const file of migrationFiles) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    await db.exec(sql);
  }

  return db;
}

/**
 * Inserts a row into auth.users and returns its id.
 */
export async function createUser(db: PGlite, email: string): Promise<string> {
  const result = await db.query<{ id: string }>(
    `insert into auth.users (email) values ($1) returning id;`,
    [email],
  );
  return result.rows[0].id;
}

async function withClaims<T>(
  db: PGlite,
  role: "anon" | "authenticated" | "service_role",
  claims: Record<string, unknown> | null,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role};`);
    if (claims) {
      const claimsJson = JSON.stringify(claims).replace(/'/g, "''");
      await tx.exec(`set local request.jwt.claims = '${claimsJson}';`);
    }
    return fn(tx);
  });
}

/**
 * Runs `fn` inside a transaction acting as the given user: role set to
 * `authenticated` and `request.jwt.claims` populated with that user's id,
 * role and email (looked up from auth.users).
 */
export async function asUser<T>(
  db: PGlite,
  userId: string,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  const result = await db.query<{ email: string }>(
    `select email from auth.users where id = $1;`,
    [userId],
  );
  if (result.rows.length === 0) {
    throw new Error(`asUser: no auth.users row for id ${userId}`);
  }
  const { email } = result.rows[0];

  return withClaims(
    db,
    "authenticated",
    { sub: userId, role: "authenticated", email },
    fn,
  );
}

/**
 * Runs `fn` inside a transaction acting as an anonymous (signed-out) caller:
 * role set to `anon`, no JWT claims.
 */
export async function asAnon<T>(
  db: PGlite,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return withClaims(db, "anon", null, fn);
}

/**
 * Runs `fn` inside a transaction acting as the Supabase service role: role
 * set to `service_role`, bypassing RLS.
 */
export async function asService<T>(
  db: PGlite,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return withClaims(db, "service_role", null, fn);
}

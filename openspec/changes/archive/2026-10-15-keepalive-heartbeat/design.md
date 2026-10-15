## Context

See proposal.md - Why. Current state: `GET /api/keepalive` (Vercel Cron, daily `0 3 * * *`, Bearer `CRON_SECRET`) does `from("member").select("id").limit(1)` with the publishable-key server client. `anon` has no grants (`20260924000200_foundation_visibility.sql` revokes all and sets default privileges to revoke), so Postgres answers 42501, which the route treats as success. Evidence shows that does not count as project activity. The app deliberately holds no Supabase secret key (archived `email-delivery/design.md`, "Alternative: a server-only secret key"); that stays.

## Model delta

Objects (Dat):
- `keepalive_heartbeat` - exactly one row, inserted by the migration. Fields: `last_ping_at : Timestamp?` (partial: null until the first accepted ping), `previous_ping_at : Timestamp?` (partial: null until the second accepted ping; the value `last_ping_at` held before the latest ping), `ping_count : Nat` (total, default 0), `token_sha256 : Hex?` (partial: null until the owner stores the hash of `CRON_SECRET`). Singleton enforced by `id smallint primary key default 1 check (id = 1)`. Stored, not deduced: it is the only record that a successful write happened, and the only place the hash lives.

Morphisms (Trn):
- `keepalive_ping : Text -> (Timestamp, Timestamp?)` - partial. Defined iff the argument is non-empty, `token_sha256` is non-null, and `sha256(token)` equals it; otherwise it raises SQLSTATE `28000` and writes nothing. When defined: `previous_ping_at = last_ping_at`, `last_ping_at = now()`, `ping_count += 1`, returns `(last_ping_at, previous_ping_at)`. Effect: one write. Executable by `anon` only (the route's role).
- `keepalive` (changed): `Request x CronSecret -> KeepaliveResult`, still partial (401 unless Bearer matches a non-empty secret). Now performs `keepalive_ping(CRON_SECRET)`; 200 `{ok, last_ping_at, previous_ping_at}` iff no error (reachable only after the secret check), else 500 `{ok:false}`.
- `t_cron`, `t_sql` unchanged; `t_sql` now carries an RPC (with the secret as argument) instead of a table select.

Consolidation check (section 3): not foldable into an existing object. Writing to `member`, `app_admin` or any family table would couple liveness to family data and need grants on it; a separate singleton keeps the callable surface to one function over one inert row. `app_private.delivery_worker` is the nearest precedent (a hashed worker secret checked in SQL), but that is delivery's object and a different caller. One new object plus one morphism.

## Goals / Non-Goals

**Goals:** a write that Postgres accepts on every run; honest failure; owner-visible proof per run; heartbeats that nobody holding only the publishable key can fake.

**Non-Goals:** alerting or monitoring beyond the dashboard and logs; changing the schedule; rate-limiting the RPC; any Supabase secret key.

## Decisions

1. **Password-locked function (kept).** `keepalive_ping(token text) returns table(last_ping_at timestamptz, previous_ping_at timestamptz)` is `security definer`, `set search_path = ''`, fully qualified names. It computes `encode(sha256(convert_to(token, 'UTF8')), 'hex')` with the built-in `sha256` (PostgreSQL 11+; no pgcrypto, so it also runs in the PGlite test harness) and compares it with `token_sha256`. A null stored hash, a null or empty token, or a mismatch raises `28000` with a message that does not include the token; nothing is written. A match runs ONE `update` that sets `previous_ping_at = last_ping_at, last_ping_at = now(), ping_count = ping_count + 1` and returns both new values. Postgres evaluates every right-hand side against the old row, so `previous_ping_at` receives the old latest time atomically: no read-then-write and no race between concurrent calls (the row lock serialises them). Because the function is plpgsql and its output columns share names with the table columns, the body qualifies every column reference with a table alias (or sets `#variable_conflict use_column`). `revoke execute ... from public, anon, authenticated`, then `grant execute ... to anon` (the route runs as anon through the publishable key with no session). The old zero-argument signature is not created.
2. **Singleton row inserted by the migration.** `id = 1` check; the migration inserts row 1 with null `last_ping_at`, null `previous_ping_at`, count 0 and null hash, so the function only updates (no upsert). Table has RLS enabled, no policies, `revoke all` from anon/authenticated. No unbounded growth; `ping_count` keeps the volume without rows.
3. **Anon-callable unguarded function (discarded).** Simpler, but anyone holding the publishable key (which ships to browsers) could fake heartbeats and mask a stopped cron.
4. **Service-role / secret key on Vercel (discarded).** Would let the route write directly, but a leak bypasses all RLS and breaks the repo invariant of holding no secret key. Here a leak of the publishable key plus the function lets an attacker do nothing.
5. **Hash comparison needs no constant-time compare.** Only SHA-256 hex digests are compared. The attacker controls the preimage, not the digest, so response timing reveals nothing usable about the stored hash's preimage. A plain `=` is acceptable.
6. **Return shape: `returns table(...)`.** supabase-js `rpc` returns an array for set-returning functions; the route calls `.rpc(...).single()` to get one object `{ last_ping_at, previous_ping_at }` (a zero-row result is an error, hence 500). Alternative: `json` return - rejected, loses typing. The route passes the database's ISO strings through as-is.
7. **Route: any error is 500, token never logged.** `supabase.rpc("keepalive_ping", { token: process.env.CRON_SECRET }).single()`. An `error` (including 28000 and 42501) gives `console.error("keepalive: ...", { status, code, message })` and 500; thrown exceptions also 500. Only `status`, `code` and `message` are logged, never the token or the request. Success logs `console.log("keepalive: ok", { last_ping_at, previous_ping_at })` so Vercel Runtime Logs show each run, and returns 200 `{ ok: true, last_ping_at, previous_ping_at }` - safe to expose because it is reachable only after the Bearer check and the times are not family data. Failure bodies stay `{ ok: false }`. Auth, fail-closed, `force-dynamic`, `no-store` unchanged.
8. **Migration filename** follows the repo convention: `20260924001500_keepalive_heartbeat.sql` (latest existing is `...001400_contacts_tip_dismissal.sql`).
9. **Hash is set by the owner, once, outside the repo.** The migration cannot know `CRON_SECRET`. After `db push`, the owner hashes the secret locally and runs a one-line `update` in the SQL Editor. Only the hash enters the database; nothing secret is in git. Rotating `CRON_SECRET` requires redoing this step.
10. **Verification moves to the Table Editor** (`keepalive_heartbeat.last_ping_at`, durable) instead of Supabase API Gateway logs (about 1 day retention). Vercel Runtime Logs show the `ok` line only within Hobby's short retention; the CDN Requests view shows the request itself.

## Coherence laws

Placement honesty (the secret is read only on `AppServer`; only its hash lives in `Db`), transmission well-typing (`t_sql` carries the RPC and its token argument; the returned times appear only in the authorised 200 body and the log), dependency mediation (the call goes through the existing Supabase server client helper), one source of truth (heartbeat state and hash only in `keepalive_heartbeat`), permissions (no app role can read or write the table directly; `authenticated` cannot execute the function).

## Risks / Trade-offs

- Forgetting the hash step (or rotating `CRON_SECRET` without redoing it) -> every run is refused and returns 500, visible as failed runs in Vercel Cron. Mitigation: task 4.3 and the setup.md note.
- Route deployed before migration -> every run 500s. Mitigation: apply the migration and store the hash before merging (Migration Plan).
- The hash lives in a table nobody but the owner can read; if exposed it only allows offline guessing of a 256-bit random secret. Accepted.
- Assumption not yet proven: that a successful RPC write counts as activity where the 401 did not. The Table Editor check proves the write, not Supabase's activity accounting; confirm by receiving no further inactivity warning.
- The SQL Editor command and PowerShell hashing step are manual and error-prone (trailing newline in the secret changes the hash). Mitigation: exact commands in tasks, and the Cron Jobs Run check in task 4.5.

## Migration Plan

1. Add the migration; test with the DB suite (PGlite harness).
2. Apply to the hosted project with `npx supabase db push` as documented in setup.md section 6 (including the Windows path-with-spaces `subst` workaround); confirm with `npx supabase migration list`.
3. Store the hash of `CRON_SECRET` in the SQL Editor (task 4.3).
4. Merge to `main` so Vercel deploys the new route.
5. Verify: Vercel Cron Jobs -> Run, then `keepalive_heartbeat.last_ping_at` in the Supabase Table Editor; next day confirm the automatic run (11:00-11:59 SGT) updated it.
6. Rollback: revert the route commit (the old behaviour still works); the table and function are inert without the matching secret and can stay, or be dropped by a follow-up migration.

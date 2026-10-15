# Proposal

## Why

Supabase emailed on 2026-10-15 (05:33 SGT) that project `cexjdjrhnextgsdgfbcr` had "not seen sufficient activity for more than 7 days", although the daily keepalive cron demonstrably fired (Supabase API logs show `GET /rest/v1/member` at 11:53 SGT, answered 401 / Postgres 42501). So a request that Postgres refuses does not count as activity, and the project will pause. The current success path also logs nothing, so a healthy run is invisible in Vercel Runtime Logs.

## What Changes

- Add a single-row table `keepalive_heartbeat` (no grants, RLS on, no policies; holds a SHA-256 hash of the cron secret) and a password-locked `keepalive_ping(token)` function. The function is reachable by the anonymous role the app runs as, but it records a heartbeat (latest time, previous time and counter) only when the supplied token matches the stored hash; every other call is refused and writes nothing.
- The keepalive endpoint calls `keepalive_ping` with `CRON_SECRET` as the token instead of selecting from `member`; success now means the heartbeat write succeeded, and the 200 body reports the latest and previous heartbeat times. The "42501 is success" behaviour is removed: any error is a 500.
- A successful run logs `keepalive: ok` with the new timestamp so each run is visible in Vercel Runtime Logs.
- Operations: the owner applies the migration to the hosted project, stores the SHA-256 hash of `CRON_SECRET` in the heartbeat row once (rotating the secret means redoing this), verifies via the Supabase Table Editor, and the setup guide's verification step changes accordingly.
- No secret/service-role key is introduced; the app stays on the publishable key. Only the hash of the cron secret enters the database.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `database-keepalive`: the "reaches the database" requirement changes from "one cheap read, expected refusal is success" to "records a heartbeat write; any failure is a failed run", and a requirement is added that a run is visibly recorded.

## Impact

- Code: `src/app/api/keepalive/route.ts`, `src/app/api/keepalive/route.test.ts`.
- Database: new migration `supabase/migrations/20260924001500_keepalive_heartbeat.sql`; new DB test under `test/db/`.
- Docs: `docs/stayover/ARCHITECTURE.md`, `IMPLEMENTATION.md`, `STATUS.md`, `general/setup.md`.
- Anyone holding the publishable key can call the function but cannot make it succeed without `CRON_SECRET`, so heartbeats cannot be faked.
- Deploy order matters: the migration must be applied and the hash stored before the new route deploys, or every run returns 500.

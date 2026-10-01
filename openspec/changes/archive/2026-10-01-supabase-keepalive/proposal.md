## Why

The free Supabase project pauses after about 7 days without activity. A family
app used only around trips can easily go that long untouched, and a paused
project means nobody can sign in or answer a stayover request until the owner
notices and restores it by hand.

## What Changes

- A daily scheduled call (Vercel Cron, once a day — the Hobby plan maximum) hits a new
  `GET /api/keepalive` endpoint on the deployed app.
- The endpoint is closed unless the caller presents the deployment's `CRON_SECRET`
  as a Bearer token; it then makes one cheap read that reaches the database
  and reports success or failure.
- The sign-in redirect layer lets the endpoint through untouched.
- Setup docs gain a step to set `CRON_SECRET` and verify the job.

## Capabilities

### New Capabilities
- `database-keepalive`: a secret-protected daily check that keeps the hosted database active and surfaces failures in the cron logs.

### Modified Capabilities
<!-- none -->

## Impact

- New: `src/app/api/keepalive/route.ts`; `vercel.json` `crons`; env var `CRON_SECRET` (server-only).
- Changed: `src/proxy.ts` (pass-through for the endpoint), `.env.example`, `docs/stayover/general/setup.md`.
- No schema change, no new grants, no secret/service key used.

## Non-goals

- Alerting beyond Vercel's cron logs.
- Restoring an already-paused project.

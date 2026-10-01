## Context

Hosting is Vercel Hobby (region sin1); the database is the Supabase free tier,
which pauses after ~7 days of no activity. Vercel Cron on Hobby may run once
per day and calls the path with `GET`, sending `Authorization: Bearer
$CRON_SECRET` when that env var exists (Vercel docs). Next.js 16 uses
`src/proxy.ts` (formerly middleware), which currently redirects every
signed-out request to `/sign-in`.

## Model delta

Objects: none new (no stored state). Morphisms:

- `keepalive` (Trn, Stayover-owned infra): `Request × CronSecret → KeepaliveResult`.
  Partial on authorisation: undefined (401) unless the Bearer token equals a
  non-empty `CRON_SECRET`. Semantics: one `head` select on `member` as the
  anonymous role; success is 200 `{ok:true}`, failure 500.
- `t_cron` (Trm): `{ GET + Bearer }`, `Vercel Cron → AppServer`.
- Existing `t_sql` (`AppServer ↔ Db`) carries the one read.

Consolidation check (§3): not a new object; one morphism plus one transmission
over existing Locs. No new Loc: Vercel Cron is the scheduler side of the
platform that hosts `AppServer`, so it is modelled as the sender end of `t_cron`.

## Decisions

1. **Which read.** `from("member").select("id").limit(1)` (a plain GET, deliberately not `head`: a HEAD response has no body, so postgrest-js cannot surface `error.code` and the `42501` refusal would be undetectable)
   through the existing `createClient()` (publishable key). The anonymous role
   has no grants on any table, so Postgres refuses with SQLSTATE `42501`
   (permission denied). That refusal proves the request traversed the API to
   Postgres and returns no data. If a future migration grants `anon` read with
   RLS, RLS filters rows and the handler discards any that return. Treated as success: no error, or
   code `42501`. Any other error (network, PGRST, 5xx, paused project) is 500.
   Rejected: a new RPC or grant (schema change for a ping); an auth-only call
   (does not touch Postgres); the secret key (never used).
2. **Fail closed.** `CRON_SECRET` unset or empty ⟹ 401 before anything else;
   comparison is constant-time.
3. **Proxy.** `/api/keepalive` is passed through like `/dev` — before any
   Supabase client or session work. The route re-checks the secret itself, so
   the pass-through grants no access.
4. **No caching.** `export const dynamic = "force-dynamic"`; response is JSON
   with `Cache-Control: no-store`.

## Coherence laws

Placement honesty (the secret is read only on `AppServer`), transmission
well-typing (`t_cron` carries only a Bearer secret; response carries `ok`),
dependency mediation (the read goes through the existing Supabase server
client helper).

## Risks

- A future grant to `anon` on `member` changes the happy path from 42501 to empty
  result; both are accepted, so nothing breaks.
- Vercel Cron timing on Hobby is imprecise within the hour; irrelevant here.

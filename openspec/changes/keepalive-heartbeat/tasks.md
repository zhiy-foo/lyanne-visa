# Tasks

## 1. Database

- [x] 1.1 Add `supabase/migrations/20260924001500_keepalive_heartbeat.sql`: table `public.keepalive_heartbeat` (`id smallint primary key default 1 check (id = 1)`, `last_ping_at timestamptz` nullable, `previous_ping_at timestamptz` nullable, `ping_count bigint not null default 0`, `token_sha256 text` nullable), RLS enabled with no policies, `revoke all` from anon/authenticated, and a seed row 1 with null times, count 0 and null hash. Verify the migration applies in the PGlite harness (task 1.3 passes).
- [x] 1.2 In the same migration add `public.keepalive_ping(token text) returns table(last_ping_at timestamptz, previous_ping_at timestamptz)` (`security definer`, `set search_path = ''`): compute `encode(sha256(convert_to(token, 'UTF8')), 'hex')` with built-ins only (no pgcrypto); if the stored hash is null, the token is null or empty, or the hashes differ, `raise exception` with SQLSTATE `28000` and a message that does not include the token; otherwise ONE `update` on row 1 (`previous_ping_at = last_ping_at, last_ping_at = now(), ping_count = ping_count + 1`) returning both new times, qualifying columns to avoid output-name conflicts. Then `revoke execute ... from public, anon, authenticated` and `grant execute ... to anon`. No zero-argument overload. Verify via task 1.3.
- [x] 1.3 Add `test/db/keepalive-heartbeat.test.ts` following `test/db/contacts-tip.test.ts` patterns. Set `token_sha256` in the test via the harness superuser connection. Cover: the first correct call returns a `last_ping_at` and a null `previous_ping_at` (count 1); the second returns `previous_ping_at` equal to the first call's `last_ping_at`, a later `last_ping_at`, count 2, still one row; wrong token, null token and empty token each raise `28000`, leave `last_ping_at`, `previous_ping_at` and `ping_count` unchanged, and the error message does not contain the token; with `token_sha256` null every call (even a plausible token) is refused with `28000`; the migration seeds exactly one row with null `last_ping_at`, null `previous_ping_at`, count 0 and null hash; anon and authenticated cannot select, insert, update or delete the table directly; authenticated cannot execute the function; a row with `id <> 1` is rejected. Run `npx vitest run test/db/keepalive-heartbeat.test.ts` and see it pass.

## 2. Route

- [x] 2.1 Change `src/app/api/keepalive/route.ts`: replace the `member` select with `supabase.rpc("keepalive_ping", { token: process.env.CRON_SECRET }).single()`; no error -> `console.log("keepalive: ok", { last_ping_at, previous_ping_at })` and 200 `{ ok: true, last_ping_at, previous_ping_at }` (previous may be null); failures stay `{ ok: false }` with 500 (401 unchanged); any error or throw -> `console.error` with only `{ status, code, message }` and 500; never log the token; delete the 42501 constant and handling; update the doc comment. Keep auth, fail-closed, `force-dynamic`, `no-store`. Verify with task 2.2.
- [x] 2.2 Update `src/app/api/keepalive/route.test.ts`: mock `rpc` instead of `from/select`; cover rpc called once with `("keepalive_ping", { token: <CRON_SECRET> })` after a valid secret; success returns 200 with both `last_ping_at` and `previous_ping_at` in the body (including a null previous on the first run) and logs `keepalive: ok` with both times; 401 and 500 bodies are exactly `{ ok: false }` with no times; a `28000` error -> 500; a generic error -> 500 and `console.error`; a 42501 error -> 500 (formerly success); thrown exception -> 500; the secret value never appears in any `console.log`/`console.error` call argument (assert over serialized calls) in both success and failure paths; 401 paths (no header, wrong secret, unset secret) never call `createClient`/`rpc`; response has `Cache-Control: no-store`. Run `npx vitest run src/app/api/keepalive` and see it pass.

## 3. Docs reconcile

- [x] 3.1 `docs/stayover/ARCHITECTURE.md`: add Dat `keepalive_heartbeat` (including `last_ping_at`, `previous_ping_at`, `ping_count`, `token_sha256`), add Trn `keepalive_ping` (partial on the token), rewrite the `keepalive` row (RPC with `CRON_SECRET`, 500 on any error, no 42501 case). Verify by grep that no "42501 still counts" text remains.
- [x] 3.2 `docs/stayover/IMPLEMENTATION.md`: add a row for `keepalive_ping` (migration file:symbol, DB test) and update the `keepalive` row (rpc, tests). Verify each file:symbol exists.
- [x] 3.3 `docs/stayover/general/setup.md` section 7 "Keepalive cron": the check becomes the Supabase Table Editor `keepalive_heartbeat` showing `last_ping_at` updating and `previous_ping_at` holding the prior run time (not API Gateway logs); add the one-time hash step (same commands as task 4.3) and the note that rotating `CRON_SECRET` requires redoing it; note Vercel Runtime Logs (short retention, shows `keepalive: ok`) versus the CDN Requests view; say to apply the migration and store the hash before deploying.
- [x] 3.4 `docs/stayover/STATUS.md`: record the change, the 2026-10-15 finding, and the remaining owner checks from group 4. Verify the keepalive rows and the stale "API Gateway 401" remaining-check line are updated.
- [x] 3.5 Before archive, run `openspec validate keepalive-heartbeat --strict` (passes), then the supercharge drift check and fix any dead rows.

## 4. Verify and deploy (owner)

- [ ] 4.1 Full suite green: run `npm test` (and the DB suite if separate), `npm run lint` and `npm run build`; all pass.
- [ ] 4.2 Apply the migration to the hosted project per setup.md section 6 (`npx supabase link`, `npx supabase db push`, with the `subst` workaround if the path has spaces). Verify `npx supabase migration list` shows matching local and remote versions and the table exists in the Table Editor with one row (count 0, other fields empty, including `previous_ping_at`).
- [ ] 4.3 One-time hash step, before merging. In PowerShell, read the production `CRON_SECRET` without echoing it and print its SHA-256 hex (no trailing newline is hashed):
  ```powershell
  $s = Read-Host "CRON_SECRET" -AsSecureString
  $p = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
  $t = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($p)
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p)
  $h = [System.Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($t))
  ($h | ForEach-Object { $_.ToString("x2") }) -join ""
  ```
  Then in Supabase SQL Editor run `update public.keepalive_heartbeat set token_sha256 = '<hex>' where id = 1;`. Verify the Table Editor shows a 64-character `token_sha256`. The secret itself is never typed into SQL; rotating `CRON_SECRET` later means repeating this step.
- [ ] 4.4 Merge to `main` so Vercel deploys. Verify the deployment succeeds.
- [ ] 4.5 Vercel -> Cron Jobs -> Run. Verify `last_ping_at` updated, `previous_ping_at` holds the previous value and `ping_count` increased in the Supabase Table Editor, and that `curl -i -H "Authorization: Bearer <CRON_SECRET>" https://<site>/api/keepalive` returns `200` with a body like `{"ok":true,"last_ping_at":"<iso>","previous_ping_at":"<iso or null>"}` whose times match the table.
- [ ] 4.6 Next day, confirm the automatic run (11:00-11:59 SGT) updated `last_ping_at` and moved the prior time into `previous_ping_at`; over the following week confirm no further Supabase inactivity warning.

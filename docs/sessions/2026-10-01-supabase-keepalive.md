# 2026-10-01 — supabase-keepalive

## 0. Continuation brief

Current state: Session 7. Owner got a Supabase inactivity-pause alert for the free project (the "uptime ping" P1 had been open since the deploy session but never built). Owner signed in to the app the same evening: dashboard Healthy, 86 requests in the last 60 min. A daily Vercel Cron keepalive was built, fixed and verified in production: Vercel calls `GET /api/keepalive` at `0 3 * * *` (03:00 UTC = 11:00 SGT) with `Authorization: Bearer $CRON_SECRET`; the route does one GET `select("id").limit(1)` on `member` with the publishable key; `anon` has no grants, so Postgres refuses with SQLSTATE 42501, which proves the database was reached → 200 `{"ok":true}`. OpenSpec change `supabase-keepalive` archived. Production = main @ 41fdc63.

Next step: after 11:00 SGT on 2026-10-02, confirm one automatic (not manually triggered) 200 in Vercel → Logs filtered `requestPath:/api/keepalive`; then pick the next post-deploy item (co-parent-requests review, family Google sign-in, NAS backups, obsolete branches).

Resume command/check: `/supercharge-start`, then Vercel → lyanne-visa → Logs, filter `requestPath:/api/keepalive`.

## 1. Work completed

- PR #8 `feat/supabase-keepalive` (commit 83f4a2a, merge ef1bac3, merged 2026-10-01 14:03 UTC): `vercel.json` crons entry (regions sin1 kept); `src/app/api/keepalive/route.ts` GET (fail-closed constant-time Bearer check against `CRON_SECRET`, unset/empty secret → 401; `dynamic = "force-dynamic"`, `Cache-Control: no-store`; returns only `{ok}`); `src/proxy.ts` early return for `/api/keepalive` so it is not redirected to sign-in; `src/app/api/keepalive/route.test.ts`, `src/proxy.test.ts`; `vitest.config.mts` `@` → `src` alias (mirrors tsconfig); `.env.example` documents `CRON_SECRET` and includes the owner's earlier uncommitted placeholder/comment tidy-up; setup.md §7 "Keepalive cron" block; ARCHITECTURE/IMPLEMENTATION/STATUS/architecture-map reconciled (Trn `keepalive`, Trm `t_cron`, Loc `Scheduler`).
- Production bug: manual Cron Jobs → Run at 22:05:48 and 22:06:18 SGT returned 500 `keepalive: Supabase read failed undefined`. Supabase API Gateway showed `HEAD /rest/v1/member?select=*&limit=1` → 401 at 22:06:19. Root cause: the read used `head: true`; postgrest-js (`node_modules/@supabase/postgrest-js/src/PostgrestBuilder.ts:446-467`, processResponse) parses the error from the response body, a HEAD reply has none, so `error.code` was undefined and the expected 42501 refusal was treated as failure. The request still reached Postgres, so the project stayed active.
- PR #9 `fix/keepalive-head-error` (commit afb1f6d, merge 41fdc63, merged 2026-10-01 14:18 UTC): plain GET `select("id").limit(1)`; error log now includes `{ status, code, message }`; regression test asserts the query is not head mode; test for undefined code → 500; "head-only" wording updated in ARCHITECTURE.md and OpenSpec design/tasks.
- Owner set `CRON_SECRET` in Vercel (type Secret, Production only; 64-char alphanumeric generated in Bitwarden, copy kept in Bitwarden). Not in `.env.local` (cron runs only on Vercel).
- Vercel PR preview builds confirmed working on PR #8 and #9 (closes the P2 item).
- Branches `feat/supabase-keepalive` and `fix/keepalive-head-error` deleted on GitHub (owner) and locally; stale remote refs pruned.
- OpenSpec `supabase-keepalive` archived; spec merged to `openspec/specs/database-keepalive/spec.md`.

## 2. Decisions

| Decision | Verdict | Why |
| --- | --- | --- |
| Keepalive mechanism: Vercel Cron | kept | free on Hobby, lives with the app, keeps running with no repo activity |
| GitHub Actions scheduled curl | discarded | GitHub disables scheduled workflows after 60 days without commits on a public repo; it would stop silently |
| UptimeRobot / external pinger | discarded | an extra external account to maintain |
| Schedule `0 3 * * *` daily | kept | Hobby allows at most once per day; pause threshold is ~7 idle days |
| HEAD (`head: true`) read | discarded | postgrest-js cannot read the error code from a HEAD reply (PR #9) |
| Success = no error or code 42501 only | kept | a bare 401/403 fallback was discarded because it would hide a wrong key or a paused project |
| Keep merged branches for rollback | discarded | rollback = Vercel Instant Rollback, GitHub Revert on the PR, or Restore branch on the PR page |
| vitest `@` alias | kept | route/proxy tests import via `@/` |
| Delete the 25 older obsolete branches this session | deferred | owner: this session is only the keepalive |

## 3. Tests, checks

| Check | Result | What it proved |
| --- | --- | --- |
| `npm test` (PR #8 branch) | 45 files, 587 passed | no regressions |
| `npm run lint`, `npx tsc --noEmit`, `npm run build` (both PRs) | clean; `/api/keepalive` dynamic | builds |
| `npx vitest run src/app/api/keepalive src/proxy.test.ts` (PR #9) | 13 passed | route auth, 42501 handling, non-head query, proxy bypass |
| CI on PR #8 | pass (6m29s, run 36872165141) | — |
| CI + Vercel preview on PR #9 | pass | preview builds work |
| `curl.exe -i https://lyanne-visa.vercel.app/api/keepalive` (no header, 22:12:48 SGT) | 401 `{"ok":false}`, `no-store`, `sin1` | fail-closed lock |
| curl with Bearer secret (22:19:35 SGT) | 200 `{"ok":true}` | end-to-end in production |
| Vercel Cron Jobs → Run (22:20:09 SGT) | 200 | Vercel sends the secret; cron path works |
| drift check | 0 dead / 201 refs | docs ↔ code |

Also note: Supabase logs showed only one of the two 500-era calls (22:06:19); the 22:05:48 one was not seen — unexplained, most likely log-explorer delay; harmless.

## 4. Live handoff state

| Type | Handle / location | State | Inspect / resume | Stop / cleanup |
| --- | --- | --- | --- | --- |
| branch | `main` | synced after this log's commit | `git status` | none |
| branches | 18 local + 7 remote older obsolete branches (list in `docs/sessions/2026-09-25-tooling-cleanup.md` §6) | still present, deferred | `git branch -a` | owner runs the commands in that log |
| scheduler | Vercel Cron `/api/keepalive` `0 3 * * *` | registered, verified by manual run | Vercel → Settings → Cron Jobs; Logs filter `requestPath:/api/keepalive` | remove the `crons` entry from `vercel.json` |
| deployment | Vercel production, main @ 41fdc63, functions sin1 | live | `curl.exe -i https://lyanne-visa.vercel.app/api/keepalive` → 401 | Vercel Instant Rollback |
| secret | `CRON_SECRET` (Vercel Production, Secret type; copy in owner's Bitwarden) | set | Vercel → Settings → Environment Variables | rotating it needs a redeploy |
| data | Supabase project `cexjdjrhnextgsdgfbcr` (free, Singapore) | active | Supabase dashboard → Logs → API Gateway, look for `GET /rest/v1/member?select=id&limit=1` 401 daily | none |
| artifact | `.claude/settings.local.json` | untracked, machine-specific | `git status` | keep untracked |

## 5. In-flight changes (from OpenSpec)

| Change | Tasks | Status | Next ready artifact |
| --- | --- | --- | --- |
| `co-parent-requests` | 0/22 | in-progress (planning complete) | awaiting owner review, then `openspec instructions apply --change "co-parent-requests" --json` |

## 6. Open items

| Priority | Item | Ref | Next action | Done when |
| --- | --- | --- | --- | --- |
| P1 | Confirm first automatic keepalive run | Vercel Logs | after 11:00 SGT 2026-10-02 filter `requestPath:/api/keepalive` | one 200 not triggered by hand |
| P1 | Delete obsolete branches | `docs/sessions/2026-09-25-tooling-cleanup.md` §6 | owner runs those commands | `git branch -a` shows only main and origin/main |
| P1 | Verify gbrain handover live | `~/.claude/scripts/` | open a new session while another holds the brain (this session's hook reported "already held by this session", so no takeover was exercised) | new session connects without `/mcp` |
| P1 | Co-parent-requests | `openspec/changes/co-parent-requests/` | owner review, then apply | merged and live |
| P1 | Google sign-in for the family | Google Cloud Console | add family Gmail test users, or Branding + Publish | family can sign in |
| P1 | Backups to home NAS | `docs/stayover/general/setup.md` | monthly `npx supabase db dump`; delete copies >12 months | first backup captured |
| P2 | Vercel dashboard Function Region | Vercel → Settings → Functions | set default to sin1 if not done | dashboard shows sin1 |
| P2 | Custom domain | registrar, Vercel, Supabase, Google | buy domain; update Site URL/Redirect URLs, origins, `NEXT_PUBLIC_SITE_URL`, /privacy | works end-to-end |
| P2 | Fine-tuning | `docs/stayover/IMPLEMENTATION.md` | human-readable email dates, clearer "no account yet", popup transparency | in place |
| P2 | Re-run DB suite on hosted Supabase | `test/db/` | include concurrent-accept race | verified |
| P3 | gbrain upgrade | `gbrain self-upgrade` | revisit when single-writer locking changes | decision recorded |

Closed this session: Uptime ping for free Supabase; Confirm Vercel PR previews build.

## 7. Architecture

New Trn `keepalive` (AppServer), new Trm `t_cron` (Scheduler = Vercel Cron → AppServer, carries the Bearer `CRON_SECRET`), and the keepalive read rides the existing AppServer → Supabase transmission with the publishable key. New Loc `Scheduler` is only the sending end of `t_cron`. No change to data objects; no secret leaves AppServer.

## 8. Docs reconciled

| Doc | Change |
| --- | --- |
| `docs/STATUS.md` | "In flight" column: removed `; supabase-keepalive built, awaiting owner` text |
| `docs/stayover/STATUS.md` | line 86: updated keepalive state to "live in production" + `CRON_SECRET` set |
| `docs/stayover/STATUS.md` | line 91: replaced keepalive bullet with "archived 2026-10-01: live; manual run and curl returned 200; remaining check..." |
| `docs/stayover/ARCHITECTURE.md` | line 357: repointed keepalive reference from `openspec/changes/supabase-keepalive` to `openspec/specs/database-keepalive` |
| `openspec/specs/database-keepalive/spec.md` | new file created from archived change |
| `docs/sessions/2026-10-01-supabase-keepalive.md` | this log |

## 9. Drift check

`supercharge-drift` → 0 dead / 201 refs. No drift.

## 10. Files changed

Code/config from PRs #8/#9 (vercel.json, src/app/api/keepalive/route.ts, src/app/api/keepalive/route.test.ts, src/proxy.ts, src/proxy.test.ts, vitest.config.mts, .env.example) + docs above + openspec archive move + this log.

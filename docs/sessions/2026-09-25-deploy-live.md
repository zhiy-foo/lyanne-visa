# 2026-09-25 — deploy-live

## 0. Continuation brief

Session 5. App deployed to production on Vercel at https://lyanne-visa.vercel.app from main 143b6f8; owner's live smoke test passed (email-link sign-in, Google sign-in, plan/accept, invites arriving). PR #7 (failed server-action calls no longer leave buttons stuck on "Working…") is open awaiting owner approval. Next: post-deployment phase per open items (see section 6), one session per item.

## 1. Work completed

Migration 20260924001400 applied to hosted Supabase by owner (`npx supabase migration list` shows 000100–001400 local = remote). PR #4 merged (063732c, actions/checkout + setup-node v4→v7). PR #6 public /privacy page built (content derived from schema/code; owner-approved wording; `vercel.json` pins functions to `sin1`; setup.md §7 note) and PR #5 auth-callback redirect via safeNextPath — both merged (72b3a76, 143b6f8). Main CI green on 143b6f8 (run 36084677935). Vercel project imported (8 env vars from .env.local; NEXT_PUBLIC_SITE_URL re-created as Config type = https://lyanne-visa.vercel.app, redeployed). Supabase Site URL + Redirect URLs set to https://lyanne-visa.vercel.app(/**). Google OAuth client Authorized JavaScript origins: https://lyanne-visa.vercel.app, http://localhost, http://localhost:3000. Live checks from the orchestrator: `/`→307 sign-in, /sign-in 200, /privacy 200 signed-out, `x-vercel-id: sin1::sin1`. Production incident: sign-in stuck on "Working…" — Vercel log showed POST /sign-in 404, 42 ms, no outgoing requests = server action not found from a page loaded from the previous deployment; fresh load fixed it. Root-cause UI bug (no try/catch around awaited actions) fixed in PR #7 (branch fix/action-failure-busy, commit on top of 143b6f8, new `src/ui/runAction.ts` + tests, all busy/pending call sites in src/ui/screens wrapped; 576 tests locally). Seven finished worktrees removed (branches kept, incl. unmerged design/a-refined-navy and design/c-sunny-family).

## 2. Decisions

| Decision | Verdict | Why |
| --- | --- | --- |
| /privacy before deploy | yes | owner |
| Privacy wording (join-code sentence, Singapore) | approved | owner |
| Vercel functions pinned to Singapore (sin1) | yes | sit next to Supabase ap-southeast-1; default iad1 would add US↔SG round trip per DB query |
| Backups on home NAS | yes | routine to be set up post-deploy per owner approval |
| Worktrees removed after deployment | yes | owner decision to remove only after deployment confirmed |
| Web Analytics / Speed Insights | off | privacy policy says no analytics |
| NEXT_PUBLIC_* variables re-created as Config | yes | Vercel "Secret" type rejected edits for NEXT_PUBLIC_ key; NEXT_PUBLIC_SITE_URL re-created as Config by design |

## 3. Tests, checks, benchmarks

| Check | Result | What it proved |
| --- | --- | --- |
| PR #4 CI | green, 6m18s | bump actions merge-ready |
| PR #5 CI | green, 6m47s | auth redirect merge-ready |
| PR #6 CI | green, 8m18s | privacy page + routing merge-ready |
| PR #6 local tests | 566 tests, screens privacy/sign-in/register 32/32 | screens built |
| Main CI after #5+#6 merge | green | merged cleanly |
| PR #7 local lint/typecheck | clean, 576 tests | runAction wrapper + test suite pass |
| Live smoke test | passed | owner verified: email-link sign-in, Google sign-in, plan/accept, invites arriving |
| Drift check | 0 dead / 199 refs | no untracked or orphaned files on main at 143b6f8 |

## 4. Live handoff state

| Type | Handle | State | Inspect / resume |
| --- | --- | --- | --- |
| branch | main | 143b6f8 synced with origin | `git status` |
| PR | #4 (chore/bump-actions) | merged (063732c) | `git log --oneline \| grep bump-actions` |
| PR | #5 (fix/auth-redirect-hardening) | merged (72b3a76) | `git log --oneline \| grep auth-redirect` |
| PR | #6 (chore/add-privacy-page) | merged (e07cea5, 143b6f8 tip) | `git log --oneline -1` |
| PR | #7 (fix/action-failure-busy) | open, 576 tests local | `gh pr view 7` |
| Vercel | production deployment | 143b6f8, Ready | functions sin1; `curl -sI https://lyanne-visa.vercel.app/sign-in \| grep -i x-vercel-id` |
| Hosted DB | Supabase migrations | 000100–001400 applied | `npx supabase migration list` |
| Vercel env vars | 8 from .env.local | set, NEXT_PUBLIC_SITE_URL = https://lyanne-visa.vercel.app | Vercel dashboard Settings |
| Worktree | `.claude/worktrees/agent-ac48528783c9b8fcc` (fix/action-failure-busy) | ready to remove | `git worktree list`; remove after PR #7 merges |
| Google OAuth | Test app | Testing status; authorized origins set | Web credentials: https://lyanne-visa.vercel.app, http://localhost:3000 |

## 5. In-flight changes (from OpenSpec)

| Change | Tasks | Status | Next ready artifact |
| --- | --- | --- | --- |
| `foundation` | 16/17 | in-progress | 4.4 (admin area refactor; not smoke-test task) |
| `email-delivery` | 17/17 | complete | 6.2 already ticked (after()/prompt confirmed post-deploy) |
| `stays` | 23/24 | in-progress | 6.6 (deployment screenshots needed) |
| `co-parent-requests` | 0/22 | draft | awaiting owner review |

## 6. Open items

| Priority | Item | Doc/code reference | Next action | Done when |
| --- | --- | --- | --- | --- |
| P0 | Merge PR #7 (runAction fix) | `gh pr view 7` | owner approval and merge | PR merged to main |
| P1 | Google sign-in for family | https://lyanne-visa.vercel.app | add family Gmail as test users OR complete branding + publish | family can sign in |
| P1 | Co-parent-requests review | openspec/changes/co-parent-requests/ | owner review of design/spec | owner approves or requests changes |
| P1 | Backups (monthly `npx supabase db dump`) | docs/stayover/general/setup.md | set up routine to home NAS, delete >12 months | first backup captured |
| P1 | Uptime ping for free Supabase | cron/scheduler | prevent idle pause when app inactive | ping running |
| P1 | Archive OpenSpec changes foundation/email-delivery | openspec/changes/ | tick remaining tasks, run `openspec archive foundation email-delivery` | changes archived |
| P1 | Screenshot update (6.6) | docs/stayover/reviews/deployment-screenshots/ | update with live app at 390px + 1280px, both themes | screenshots committed |
| P2 | Vercel preview deployments | github.com/zhiy-foo/lyanne-visa | add f00zy94@hotmail.com to Vercel team or set local git author email to zhiy-foo account | PR previews build |
| P2 | Custom domain | domain registrar | buy domain, update Supabase Site URL/Redirect URLs, Google origins, NEXT_PUBLIC_SITE_URL, /privacy links | domain active |
| P2 | Fine-tuning | docs/stayover/IMPLEMENTATION.md | human-readable email dates, clearer "no account yet" messaging, popup transparency | features in place |
| P2 | Re-run DB suite on hosted Supabase | test/db/ | includes concurrent-accept race (not exercised in PGlite) | race condition verified safe |

## 7. Architecture / model changes

New `Loc` placement: Vercel Functions pinned to sin1 (Singapore) via `vercel.json`, sitting next to Supabase ap-southeast-1.

New route `/privacy` (public, static; added to `routing.ts` ALWAYS_PUBLIC_PATHS).

Post-sign-in redirect composed through `safeNextPath` in `src/app/auth/callback/route.ts`.

PR #7 (pending) adds `src/ui/runAction.ts` (wraps `fetch` POST of server actions with try/catch, guarding against stale page loads).

## 8. Docs reconciled

| Doc | Change |
| --- | --- |
| docs/IMPLEMENTATION.md | `/privacy` row added (PR #6) |
| docs/stayover/general/setup.md | §7 note added: Vercel functions pinned to sin1 (PR #6) |
| openspec/changes/foundation/tasks.md | 4.4 not ticked (not the live smoke-test task; that was 5.1, already ticked in earlier session) |
| openspec/changes/email-delivery/tasks.md | 6.2 already ticked (confirmed after()/prompt needed post-deploy) |
| docs/sessions/2026-09-25-deploy-live.md | this log |

## 9. Drift check

Ran at main 143b6f8: 0 dead / 199 refs. No drift.

## 10. Files changed

- **PR #4** (chore/bump-actions): .github/workflows/ci.yml (actions/checkout v4→v7, setup-node v4→v7)
- **PR #5** (fix/auth-redirect-hardening): src/app/auth/callback/route.ts, src/stayover/routing.test.ts
- **PR #6** (chore/add-privacy-page): src/app/privacy/page.tsx, src/ui/screens/Privacy.tsx, src/stayover/routing.ts (+ test), src/ui/screens/SignIn.tsx, Register.tsx, dev gallery registry, vercel.json, docs
- **PR #7** (pending, fix/action-failure-busy): src/ui/runAction.ts (+ test), src/ui/screens/* (wrapped call sites)
- **Session log**: docs/sessions/2026-09-25-deploy-live.md

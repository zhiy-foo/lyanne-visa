# 2026-09-25 — design-and-deploy-prep

## 0. Continuation brief

Session 4. Git sync fixed (session-3 log onto main, a58b8c2). Visual redesign explored
as three variants (A refined navy, B passport & paper, C sunny family) by Sonnet
implementers, two review rounds each; owner chose B; merged via PR #2 (f9f9739). Contacts
tip dismissal moved from localStorage to per-account (`member.contacts_tip_dismissed_at`,
migration 20260924001400) fixing a hydration mismatch; merged via PR #3 (442738c). PR #4
(bump actions/checkout + setup-node v4→v7, CI green) and PR #5 (auth callback redirect
through safeNextPath, CI green) open, awaiting owner approval. Deployment audit: 8 env
vars match code/setup.md §7/.env.example; hosted DB has 000100–001300; 001400 not yet
applied. Next: owner applies 001400 (`npx supabase db push`), approves PR #4/#5, then
Vercel import per setup.md §7.

## 1. Work completed

- Three design variants on branches: design/a-refined-navy (5b18691, 6587e0a), design/b-passport-paper (c3fa191, 013d13d), design/c-sunny-family (18604a5, f210ae9)
- Comparison artifact: https://claude.ai/artifact/7GTcShYck1ymk4JuB2pxyn
- Design variant B "Passport & paper" chosen by owner after local testing
- PR #2 merged (f9f9739): visual redesign refactor (src/ui/**, globals.css, layout.tsx fonts, design-reference.md, screenshots)
- Pre-existing 43px calendar touch-target bug fixed by the design refresh
- Contacts tip dismissal: moved from localStorage to per-account column `member.contacts_tip_dismissed_at`, fixing hydration mismatch; migration 20260924001400
- PR #3 merged (ba8e101, b8c0b13 → 442738c): contacts-tip fix (migration 001400, applications page/client, stayover data/actions/errors, test/db/contacts-tip.test.ts, docs)
- PR #4 opened (8285329): bump actions/checkout + setup-node v4→v7 for Node.js v20 deprecation warning cleanup; CI green
- PR #5 opened (442d790): auth callback redirect through safeNextPath security hardening; CI green
- Deployment readiness audit complete; 8 env vars verified
- Drift check run (0 dead / 198 refs)

## 2. Decisions

| Decision | Verdict | Why |
| --- | --- | --- |
| Visual design variant | Chosen: B "Passport & paper" | Owner after reviewing all three locally |
| Contacts tip dismissal storage | Per-account column, not localStorage | Fixes hydration mismatch; owner approved |
| Worktree cleanup timing | Remove after deployment confirmed | Owner decision to defer until go-live confirmed |
| PR merge gates | Owner approval required | Applied to PR #2, #3; #4, #5 pending approval |
| Sub-agent roles | Scribe (haiku) / Implementer (Sonnet) only | Owner reaffirmed after session usage limit hit |
| Hosted DB migrations | Left to owner | 001400 must be applied before deployment |

## 3. Tests, checks, benchmarks

| Check | Result | What it proved |
| --- | --- | --- |
| Variant A lint + typecheck | clean, 553 tests, 216 screenshots | build valid |
| Variant B lint + typecheck | clean, 553 tests, 216 screenshots | build valid; pre-existing 43px bug fixed |
| Variant C lint + typecheck | clean, 553 tests, 216 screenshots | build valid |
| PR #2 CI (redesign) | green, 8m32s | visual changes merge-ready |
| PR #3 CI (contacts-tip fix) | green, 8m39s | migration + per-account fix safe |
| Main after PR #3 merge | green, 8m49s (run 36045991891) | two PRs merged cleanly |
| PR #4 CI (bump actions) | green, 6m18s | Node 20 deprecation annotation gone; only ubuntu-latest annotation remains |
| PR #5 CI (auth redirect) | green, 6m47s; 558 tests locally | safeNextPath applied to callback route |
| Drift check | 0 dead / 198 refs | no untracked or orphaned files on main at 442738c |
| Hosted DB migrations | 000100–001300 present | 001400 not yet applied (owner to push) |

## 4. Live handoff state

| Type | Handle | State | Inspect / resume |
| --- | --- | --- | --- |
| branch | main | 442738c synced with origin | `git status` |
| PR | #2 (design/b-passport-paper) | merged (f9f9739) | `gh pr view 2` |
| PR | #3 (contacts-tip fix) | merged (442738c) | `gh pr view 3` |
| PR | #4 (chore/bump-actions) | open, green | `gh pr view 4` |
| PR | #5 (fix/auth-redirect-hardening) | open, green | `gh pr view 5` |
| Hosted DB | Supabase "Lyanne Stayovers" | migrations 000100–001300 applied | run `npx supabase migration list` |
| Hosted DB | migration 001400 | not yet applied | owner to run `npx supabase db push` |
| Vercel | project | not imported yet | setup.md §7 |
| Worktrees | design/a, design/b, design/c, contacts-tip, #4, #5 | kept locally until deploy confirmed | `git worktree list`; remove after deployment confirmed |
| Artifact | comparison | 3-variant live demo | https://claude.ai/artifact/7GTcShYck1ymk4JuB2pxyn |

## 5. In-flight changes (from OpenSpec)

| Change | Tasks | Status | Next ready artifact |
| --- | --- | --- | --- |
| `foundation` | 16/17 | in-progress | 4.4 (live smoke on Vercel post-deploy) |
| `stays` | 23/24 | in-progress | 6.6 (screenshots after deploy) |
| `email-delivery` | 17/17 | complete | 6.2 (verify Vercel `after()` with one send post-deploy) |
| `co-parent-requests` | 0/22 | draft | awaiting owner review and approval |

## 6. Open items

| Priority | Item | Next action |
| --- | --- | --- |
| P0 | Apply migration 001400 to hosted Supabase | owner runs `npx supabase db push` |
| P0 | Approve/merge PR #5 (security hardening) | before go-live |
| P0 | Approve/merge PR #4 (CI maintenance) | non-blocking but clean before deploy |
| P0 | Vercel import + 8 env vars | setup.md §7; DELIVERY_WORKER_SECRET must match local value |
| P0 | Set NEXT_PUBLIC_SITE_URL + redeploy | after Vercel import |
| P0 | Live smoke test | email link + Google sign-in, plan/accept, invites arrive promptly (verifies after() on Vercel) |
| P1 | Stay screenshots 6.6 | update with live app deployment screenshots at 390px + 1280px, both themes |
| P1 | Foundation 4.4 (live smoke) | email link, Google, plan/accept, invites confirm after() works |
| P1 | Google OAuth app publishing | add family as test users or publish (needs /privacy + branding; deferred post-deploy by owner) |
| P1 | Co-parent-requests review | needs owner sign-off before implementation |
| P2 | Remove worktrees | after deployment confirmed working |
| P2 | Custom domain + branded Google sign-in | buy domain, add /privacy, complete Google branding + verification |
| P2 | Email date humanization | "Fri 25 Sep → Wed 30 Sep" instead of ISO dates in subject/body |
| P2 | Clearer "no account yet" messaging | for co-host/co-parent signup prompts |
| P2 | Popup transparency polish | visual refinement deferred post-deploy |
| P2 | Re-run DB suite on hosted Supabase | includes concurrent-accept race (PGlite single connection cannot exercise this) |
| P2 | Uptime ping + db dumps | add ping to prevent idle pause; occasional `supabase db dump` |

## 7. Architecture / model changes

New `Dat` (Member field): `member.contacts_tip_dismissed_at` (timestamp, per-account dismissal state for the Contacts tip).

New `Trn` (Transmission/function): `dismiss_contacts_tip()` and read `contacts_tip_dismissed()` (both security definers, caller's own row via `app_private.my_member_id()`).

Visual design reference replaced by variant B ("Passport & paper", `docs/stayover/general/design-reference.md`).

## 8. Docs reconciled

| Doc | Change |
| --- | --- |
| docs/STATUS.md | component table rows (Stayover: state/headline gap/in-flight; Delivery: built + in-flight) |
| docs/stayover/general/design-reference.md | updated for variant B (PR #2) |
| docs/stayover/IMPLEMENTATION.md | PR #3 rows added for new Dat/Trn |
| docs/delivery/STATUS.md | already reconciled in session 3 |
| docs/sessions/2026-09-25-design-and-deploy-prep.md | this log |

## 9. Drift check

Ran at main 442738c: 0 dead / 198 refs. No drift.

## 10. Files changed

- **PR #2** (design/b-passport-paper → main): src/ui/**, globals.css, layout.tsx fonts, design-reference.md, design review screenshots
- **PR #3** (contacts-tip → main): migration 20260924001400, src/app/applications/page.tsx, src/stayover/data/*.ts, src/stayover/actions/stays.ts, src/stayover/errors.ts, test/db/contacts-tip.test.ts, docs (IMPLEMENTATION.md)
- **PR #4** (chore/bump-actions): .github/workflows/ci.yml (actions/checkout v4→v7, setup-node v4→v7)
- **PR #5** (fix/auth-redirect-hardening): src/app/auth/callback/route.ts, src/stayover/routing.test.ts

# 2026-09-24 — stays-email-ship

## 0. Continuation brief
Stages 2 (stays) and 4 (email delivery) are built, reviewed, committed and live-tested
locally against hosted Supabase. All migrations 000100–001300 are pushed. Hosting
switched to Vercel. Branch `feat/foundation` is pushed to GitHub with PR #1 open to
`main`. First CI run failed on `LayoutProps` (route types not generated in a clean
checkout) and was fixed by `next typegen && tsc --noEmit` (0fe8196). GitHub CLI installed and authenticated as `zhiy-foo`. CI run 35979749708 passed (8m42s) and PR #1 was merged into `main` (merge commit 859c870) with owner approval. Session 4 starts at the Vercel import.
Next: import `zhiy-foo/lyanne-visa` on Vercel from `main` with Node 22.x and the 8 env vars (setup.md §7; `NEXT_PUBLIC_SITE_URL` as a placeholder) → deploy → set the production URL in `NEXT_PUBLIC_SITE_URL` and redeploy, Supabase Site URL/Redirect URLs and Google Authorized JavaScript origins → live smoke test (email link, Google, plan/accept, invite arrives promptly — confirms after() on Vercel) → final security pass → uptime ping.

## 1. Work completed
- Stays DB: application/move tables, RLS, fold, record_move/open_application/
  place_capacity_status/delete_application (9dc5b2b).
- Stays wiring: read functions (my_applications, application_moves names only,
  application_participants, set_place_capacity), actions, loaders, routes /overview
  /applications /applications/new /applications/[id], nav per role, landing on
  /overview, host capacity field (57b7d07).
- Email core: dispatch outbox, ICS rendering, Gmail SMTP mailer + console double,
  send loop.
- Review found claim/record functions open to any signed-in identity, fixed with a
  hashed server-only worker secret (fd1acdd).
- Theme script via InlineScript helper per Next docs (3e82fad).
- Plan-a-stay capacity check moved out of render (2792151).
- Email wiring: dispatch rows queued inside the domain functions with a payload
  snapshot, notices and invites rendered, sent via after() plus throttled proxy retry,
  admin Deliveries page, delivery status line (277df58).
- Docs switched to Vercel (fe16ff6).
- Post-deploy fine-tuning list (956e6ee).
- Fixed-locale timestamps (hydration fix) and invite status counting only the latest
  invites, migration 001300 (8df2a5e).
- Calendar invite spans drop-off through pick-up day inclusive (c9ea581).
- GitHub Actions CI (1e581b3, 0fe8196).
- Branch pushed, PR #1 opened by owner.
- Session logs split into three sessions (0161b0e).
- GitHub CLI installed and authenticated by owner (`zhiy-foo`).
- CI green on PR #1; PR #1 merged into `main` via `gh pr merge 1 --merge` (859c870).

## 2. Decisions
| Decision | Verdict | Source |
| --- | --- | --- |
| Host on Vercel | chosen over Netlify | owner; native after() |
| Calendar invite date range | drop-off through pick-up day inclusive | owner decision |
| Post-deploy fine-tuning | human email dates, clearer "no account yet" message, popup transparency | owner decision |
| Gmail invite card fallback | none; no "Add to Google Calendar" | confirmed for non-alias recipient |
| Family launch timing | after deployment | no Google test users added yet; owner to publish or add before launch |
| Pre-ship steps | approved: security review, CI, push + PR | owner decision |
| Final security pass | before or after deploy | owner decision |
| Session boundary | session 3 ends at PR #1 merge; session 4 starts at Vercel import | owner decision |

## 3. Tests, checks, benchmarks
| Check | Result | What it proved |
| --- | --- | --- |
| Full vitest suite at email completion | 537 passing | unit + PGlite DB |
| Key suites re-run by orchestrator | 462 passing | — |
| tsc and lint | clean | — |
| `next build` in isolated worktree | passes | placeholder public env; all user-dependent routes dynamic |
| `npm audit --omit=dev` | 0 vulnerabilities | — |
| Security review over whole branch | no high-confidence findings | optional hardening: reuse safeNextPath same-origin check in resolveDestination |
| Live: plan → accept → email | notices and invites received | email delivery works end-to-end |
| Live: Gmail event card | Yes/No/Maybe for non-alias address | calendar integration works |
| GitHub Actions CI, run 35979749708 | passed in 8m42s | lint, typecheck, tests, build pass on a clean checkout; annotations only: Node 20 action deprecation, `ubuntu-latest` → Ubuntu 26 from 19 Oct 2026 |

## 4. Live handoff state
| Type | Handle / location | State | Inspect / resume |
| --- | --- | --- | --- |
| branch | `feat/foundation` | pushed; merged into `main` via PR #1 | `git log -1 --format='%h %s'` |
| branch | `main` | merge commit 859c870; Vercel builds from here | `gh pr view 1` |
| CI | GitHub Actions run 35979749708 | green | `gh run list --limit 3` |
| hosted DB | Supabase project "Lyanne Stayovers" | migrations 000100–001300 pushed | Supabase dashboard |
| Vercel | project not yet imported | ready | import repo; set 8 env vars (Node 22) |
| env | 8 vars needed on Vercel | NEXT_PUBLIC_SITE_URL, Supabase URL/Redirect URLs, Google origins | setup.md §7 |
| GitHub CLI | `gh` | installed, authenticated as `zhiy-foo` | `gh auth status` |

## 5. In-flight changes (from OpenSpec)
| Change | Tasks | Status | Next ready artifact |
| --- | --- | --- | --- |
| `foundation` | 16/16 | implemented; task 4.4 unticked; not archived | archive |
| `stays` | — | built, reviewed, committed, live-tested | screenshots 6.6 open |
| `email-delivery` | — | built, reviewed, committed, live-tested | confirm Vercel after() with one real send after deploy (6.2) |
| `co-parent-requests` | — | untracked draft | needs review + owner approval |

## 6. Open items
| Priority | Item | Next action |
| --- | --- | --- |
| P0 | Import Vercel project | setup.md §7; set 8 env vars (Node 22) |
| P0 | Live smoke test on Vercel | email link, Google, plan/accept, invites arrive promptly |
| P1 | Stays screenshots 6.6 | update with deployment screenshots |
| P1 | Re-run DB suite on hosted Supabase | re-run concurrent-accept race also |
| P1 | Co-parent-requests review | needs owner approval before building |
| P2 | Custom domain, /privacy, Google branding/publish | post-deploy list |
| P2 | Fine-tuning items | post-deploy list; human email dates, clearer messaging |
| P2 | Supabase free tier idle pause | add uptime ping; no restorable backups — occasional `supabase db dump` |
| P2 | GitHub Actions deprecation warnings | bump actions/checkout and setup-node majors (Node 20 deprecation) |

## 7. Architecture / model changes
Capacity morphism and rule 22 added to stayover ARCHITECTURE. StayoverEvent port
realised as a DB-side outbox (dispatch rows inserted by the domain functions), TS
event kept as a redacted dev log. `ev_span` now inclusive of pick-up day
(DTEND = pick-up + 1).

## 8. Docs reconciled
| Doc | Change |
| --- | --- |
| docs/stayover/IMPLEMENTATION.md | STATUS updated |
| docs/delivery/IMPLEMENTATION.md | STATUS and ARCHITECTURE updated |
| docs/architecture-map.md | §5 updated |
| docs/stayover/general/setup.md | email setup, worker secret, Vercel §7, CI §6a |

## 9. Drift check
Not run this session.

## 10. Files changed
Stays database (000700+), functions, wiring (actions, loaders, routes, read functions).
Email delivery core (outbox, ICS, SMTP, send loop), wiring (dispatch queueing, render,
after() + retry, admin page, status line), migrations. GitHub Actions CI workflows.
Theme script (InlineScript), Google sign-in on own page. Migrations 000500, 000600,
001300. Post-deploy list in docs/stayover/STATUS.md.

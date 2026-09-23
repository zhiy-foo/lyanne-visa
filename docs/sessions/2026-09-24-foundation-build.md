# 2026-09-24 — foundation-build

## 0. Continuation brief
Current state: the design (docs/) is agreed and committed, and OpenSpec change
`foundation` is fully implemented on branch `feat/foundation` (16/16 tasks; last
commit is this log's commit). Sign-in (email link + Google), self-registration with
join code / waiting list, admin account management, parents' children, hosts' homes,
co-parent/co-host links, database visibility rules and the stage-1 styled UI are
built. Everything passes locally (148 tests on PGlite, lint, typecheck, build,
72 screenshot checks, drift 0 dead / 113). **Not yet verified against the hosted
Supabase project**: migrations have not been pushed, so live sign-in has never run.
The change is not archived — archive only after the live smoke checklist passes.
Next step: owner pushes the migrations and seeds the admin row (setup step 6), then
runs the app locally and walks the smoke checklist.
Resume command/check: open `docs/stayover/general/setup.md` §6, then
`npx supabase login && npx supabase link --project-ref <ref> && npx supabase db push`.

## 1. Work completed
- Discovery with the owner; architecture model written (docs/architecture-map.md,
  docs/stayover/ARCHITECTURE.md, docs/delivery/ARCHITECTURE.md) and revised through
  O1–O9.
- UI contract (docs/stayover/general/ui-design-brief.md) and design reference from the
  owner's screenshots (docs/stayover/general/design-reference.md, design/*.png).
- Setup guide for the owner (docs/stayover/general/setup.md) — updated for Supabase's
  publishable keys and Google Auth Platform's new screens.
- OpenSpec change `foundation` (proposal, specs account-access + children-and-homes,
  design, tasks) implemented by implementer sub-agents, each reviewed here before commit.
- Review record: docs/stayover/reviews/review-foundation.md.

## 2. Decisions
| Decision | Verdict | Why |
| --- | --- | --- |
| Accounts | self-register, one role (parent/host); join code ⟹ active, else waiting list | owner, O8/O9 |
| Admin | configured identity (`app_admin` table), not a member | owner: admin-only account lyanne.stayovers@gmail.com |
| Family object / tenant | discarded — single tenant | one deployment = one family |
| Invitations | discarded | owner chose registration only |
| Calendar | email .ics invites only; Google Calendar API discarded | O4, no OAuth verification burden |
| Email sender | Gmail SMTP from the app account | O3, no domain |
| Hosting | Netlify; GitHub Pages discarded (static only); Vercel not needed | owner has Netlify |
| Frontend design | free-Claude outsourcing abandoned (ran out); built here from screenshots | owner |
| DB tests | PGlite + Supabase shim (no Docker on this machine) | re-run on hosted Supabase before relying |
| Writes | SECURITY DEFINER functions only; tables SELECT-only via RLS | bypass-proof rules, atomic last-parent/host checks |
| Home directory | definer function, not a view | Supabase security-definer-view lint |
| Supabase key | publishable key (`sb_publishable_…`), never secret/service_role | new Supabase keys |
| Google OAuth app | stays in Testing until Branding (needs `/privacy` + live domain) | publishing requires Branding |
| GitHub integration in Supabase | off | migrations applied deliberately |

## 3. Tests, checks, benchmarks
| Check | Result | What it proved |
| --- | --- | --- |
| `npm test` | 9 files, 148 passed | DB rules/functions on PGlite, routing, error mapping, validation |
| `npm run screens` | 72 passed | all stage-1 screens render; no overflow; ≥44 px targets |
| `npm run build` | ok, `ƒ Proxy` | production build incl. Next 16 proxy |
| `npm run lint`, `npm run typecheck` | clean | |
| drift check | 0 dead / 113 refs | docs ↔ code mapping resolves |
| dummy-env `next dev` curl | signed-out → 307 `/sign-in?next=…`; `/sign-in` 200 | routing without credentials |

## 4. Live handoff state
| Type | Handle / location | State | Inspect / resume | Stop / cleanup |
| --- | --- | --- | --- | --- |
| branch | `feat/foundation` (from `design/initial-architecture`, from `main`) | clean after this commit; **not pushed** | `git status; git log --oneline -12` | none |
| hosted DB | Supabase project "Lyanne Stayovers" (Singapore) | created; SMTP + Google provider configured by owner; **no migrations pushed; no admin row** | Supabase dashboard → Table Editor | none |
| env | `.env.local` (git-ignored) | owner created with URL + publishable key (names only recorded) | `git check-ignore -v .env.local` | none |
| Google OAuth | Google Cloud project `lyanne-visa` | client created; app in **Testing** with owner-listed test users | Google Auth Platform → Audience | publish after Branding |
| Netlify | — | not set up | — | — |
| process | none | no dev servers left running | — | — |
| artifact | `docs/stayover/reviews/foundation-screens/*.png` (72) | committed | `npm run screens` regenerates | keep |

## 5. In-flight changes (from OpenSpec)
| Change | Tasks | Status | Next ready artifact |
| --- | --- | --- | --- |
| `foundation` | 16/16 | implemented; **do not archive until live smoke passes** | archive |

## 6. Open items
| Priority | Item | Doc/code reference | Next action | Done when |
| --- | --- | --- | --- | --- |
| P0 | Push migrations + seed admin | setup.md §6 | `npx supabase db push`; SQL insert into `app_admin` | admin sign-in lands on /admin |
| P0 | Live smoke checklist (task 5.1) | review-foundation.md | run `npm run dev`; admin sets code; parent registers with code; stranger without; host adds home; co-parent/co-host by email | all steps pass; recorded in a new review note |
| P1 | Re-run DB suite against hosted Supabase or Docker | test/db/ | point harness at a real Postgres, or install Docker + `supabase start` | suite green on real Supabase |
| P1 | Netlify deploy | setup.md §7 | push branch, merge to main, import repo, env vars, then setup §5 URLs | site loads and sign-in works live |
| P2 | Public `/privacy` page, then Google Branding + Publish | docs/stayover/STATUS.md | small change | Google app "In production" |
| P2 | Archive `foundation` | openspec/changes/foundation | `/opsx:archive` after P0s | specs merged into openspec/specs |
| P2 | Change 2 — applications and negotiation | docs/stayover/ARCHITECTURE.md §5–6 | `/opsx:propose` | proposal validated |

## 7. Architecture / model changes
Added to the stayover model this session: `m_role`, `m_status` (waiting/active/
deactivated), `admin?` predicate, join code (`Settings.joinCode`, rule 21), rules
14–21, read Trns `readAccount`, `readEmails`, `homeDirectory`; removed `Family`,
invitations and `m_manager`. Delivery: email invites only; `MemberWaiting` notice to
the admin (change 4). No known model/code divergence beyond those recorded in
docs/stayover/IMPLEMENTATION.md "Notes / divergences".

## 8. Docs reconciled
| Doc | Change |
| --- | --- |
| docs/stayover/IMPLEMENTATION.md | realised rows → `file:symbol`, state built; Tested-at column |
| docs/stayover/STATUS.md, docs/STATUS.md | Stayover 🟡 partial; open items |
| docs/IMPLEMENTATION.md | code roots, entry points |
| docs/stayover/ARCHITECTURE.md | read Trns added |
| openspec/changes/foundation/design.md | realisation notes (home_directory, read functions, proxy) |
| docs/stayover/reviews/review-foundation.md | §4.5 checklist run |

## 9. Drift check
`drift-check.sh` → 0 dead / 113 refs. Clean.

## 10. Files changed
See `git log --stat design/initial-architecture..feat/foundation`. Code roots:
`src/app/`, `src/stayover/`, `src/ui/`, `src/proxy.ts`, `supabase/migrations/`,
`test/db/`, `e2e/`; config: `package.json`, `.nvmrc`, `.env.example`,
`playwright.config.ts`, `vitest.config.mts`, `next.config.ts`.

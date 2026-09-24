# 2026-09-24 — setup-and-polish

## 0. Continuation brief
Foundation live-verified on hosted Supabase. Stages 2 (stays) and 4 (email-delivery)
planned. Stays UI built with fixtures/gallery. At session end the stays database work
(task groups 1–4, migrations 000700+) was in progress by an implementer agent,
uncommitted. `openspec/changes/co-parent-requests/` exists untracked (main parent +
co-parents model, needs review and owner approval before building). Next: review and
commit stays DB work, wire screens to data, owner pushes migrations. Resume: check
implementation status in openspec/changes/stays and co-parent-requests/.

## 1. Work completed
- Owner completed setup: Supabase project, Gmail SMTP, Google OAuth, admin seed.
- Browser login for Supabase CLI (508d1f6).
- `subst L:` workaround for spaces in path for `db push` (b595681).
- Migrations 000100–000600 pushed.
- Fixes: Google sign-in env vars inlined statically (d8aae31); `set_join_code` WHERE
  for pg-safeupdate + migration 000500 + WHERE-scan test (b0ef2f0).
- Sign-in rate-limit message and live countdown (047150e, 0e9081d).
- Child-neutral copy (a4464a1).
- Warmer host blurb (db1d2ae).
- Neutral "Access not available" wording (1fed068).
- Admin split into Accounts/Children/Homes pages (eb606d6).
- Google Identity Services sign-in on own page with hashed nonce and same-origin
  next-path check (0b9b963).
- Admin polish: aligned role controls, info tooltip, collapsed cards, sliding drawer
  (109e26c).
- Collapsed Deactivated section; admin delete for accounts with no history, migration
  000600 (36ab685).
- Theme bootstrap via next/script and role-hint placement (0e50f05, ecac263).
- Plans for stays + email-delivery (cf34d34).
- Stays UI screens: Overview calendar, Applications, Plan a stay, Application detail
  (6132b98).

## 2. Decisions
| Decision | Verdict | Source |
| --- | --- | --- |
| Home capacity | optional; blank = no limit | owner decision |
| Home time zone field | stays visible | owner decision |
| Host copy | names the child only once an application exists | owner decision |
| Post-deploy custom domain | planned | owner decision O2 |
| Post-deploy /privacy page | planned | owner decision O2 |
| Post-deploy Google branding/verification | planned | owner decision O2 |
| Popup transparency polish | deferred until after deployment | owner decision |
| Co-parent duplicates | handled by main parent + co-parents with request/approve + admin merge | owner decision |
| MVP scope correction | must include the core stay flow, not just sign-in | owner clarification |

## 3. Tests, checks, benchmarks
| Check | Result | What it proved |
| --- | --- | --- |
| Live smoke test on hosted Supabase | passed | admin, join code, Mum, Grandma, Dad as co-parent, stranger waiting then declined, delete |
| Google sign-in | shows consent screen | OAuth flow works end-to-end |

## 4. Live handoff state
| Type | Handle / location | State | Inspect / resume |
| --- | --- | --- | --- |
| branch | `feat/foundation` | clean after this commit | `git status; git log --oneline -12` |
| hosted DB | Supabase project "Lyanne Stayovers" | migrations 000100–000600 pushed; admin seed complete | Supabase dashboard |
| stays DB work | openspec/changes/stays | in progress by implementer agent; uncommitted; task groups 1–4 | check implementation status |
| co-parent-requests | openspec/changes/co-parent-requests/ | untracked draft | needs review + owner approval before building |
| env | `.env.local` | configured | `git check-ignore -v .env.local` |
| Google OAuth | Google Cloud project `lyanne-visa` | in Testing; consent screen confirmed | continue |
| Netlify | — | not set up | — |
| process | none | no dev servers left running | — |

## 5. In-flight changes (from OpenSpec)
| Change | Tasks | Status | Next ready artifact |
| --- | --- | --- | --- |
| `foundation` | 16/16 | implemented; task 4.4 unticked; not archived | archive after smoke results |
| `stays` | task groups 1–4 | UI done (6132b98); DB in progress | review and commit; wire screens |
| `email-delivery` | — | planned | building after stays |
| `co-parent-requests` | — | untracked draft | review + owner approval |

## 6. Open items
| Priority | Item | Next action |
| --- | --- | --- |
| P0 | Review and commit stays DB work | check implementer output; re-run suite |
| P0 | Update review-foundation with smoke results, then archive | docs/stayover/reviews/review-foundation.md |
| P1 | Co-parent-requests review and owner approval | openspec/changes/co-parent-requests/ |
| P1 | Wire stays screens to data | after stays DB committed |
| P2 | Hosting (then Netlify) | setup.md §7 |
| P2 | Post-deploy items | custom domain, /privacy, Google branding/publish, fine-tuning |

## 7. Architecture / model changes
Capacity decision recorded (907c645); stays uses row locks instead of an exclusion
constraint (agreed dates are deduced, no stored column).

## 8. Docs reconciled
| Doc | Change |
| --- | --- |
| docs/stayover/general/setup.md | CLI login, subst workaround, GIS origins, NEXT_PUBLIC_GOOGLE_CLIENT_ID |

## 9. Drift check
Not run this session.

## 10. Files changed
UI screens committed: 72 stage-1 screens in docs/stayover/reviews/foundation-screens/.
Admin, sign-in, registration, home pages, and stays UI skeletons. Theme bootstrap,
role icons, Google sign-in page. Migrations 000500 and 000600 (set_join_code WHERE,
deactivated section).

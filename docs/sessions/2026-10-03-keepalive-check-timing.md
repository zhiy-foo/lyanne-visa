# 2026-10-03 — keepalive-check-timing

## 0. Continuation brief
Current state: Session 8, short; no code changed. Production unchanged at main @ 98bdc3d. Owner tried to confirm the first automatic keepalive run but looked at Vercel and Supabase logs for "last hour" around 23:00 SGT on 2026-10-02; the cron fires at 03:00 UTC = 11:00 SGT (Hobby: anywhere in 11:00–11:59 SGT), so nothing was in that window. Vercel Hobby runtime logs are believed to keep only ~1 hour, so Vercel can never show a past cron run; Supabase free-plan logs keep ~1 day and are the place to check. The first automatic run is still unconfirmed.
Next step: after 12:00 SGT on 2026-10-03, open Supabase → Logs, Time Range "Last 24 hours", Log Type API Gateway, and look for `GET /rest/v1/member?select=id&limit=1` → 401 between 11:00 and 11:59 SGT. Present → close the P1. Absent → check Vercel → Settings → Cron Jobs (listed and enabled?) and that the production deployment includes the `crons` entry in `vercel.json`.
Resume command/check: `/supercharge-start`, then the Supabase check above.

## 1. Work completed
- `/supercharge-start`: preflight OK (graphify 0.9.67, openspec 1.13.1, semble 0.5.5, gbrain 0.52.2.0); gbrain held by this session.
- Diagnosed the "no daily trigger in logs" report as a wrong time window plus Vercel Hobby log retention, not a cron failure.
- Recorded where and when to check in the living docs (see §8).

## 2. Decisions
| Decision | Verdict | Why |
| --- | --- | --- |
| Verify the cron via Vercel Logs | discarded | Hobby runtime logs keep ~1 h; a run at 11:00 SGT is gone long before anyone looks |
| Verify the cron via Supabase API Gateway logs | kept | free plan keeps ~1 day; the keepalive leaves a daily `GET /rest/v1/member?select=id&limit=1` 401 |
| Change the schedule or add persistent run logging | not now | confirm the first automatic run first |

## 3. Tests, checks, benchmarks
| Check | Result | What it proved |
| --- | --- | --- |
| `curl https://lyanne-visa.vercel.app/api/keepalive` (no header) | 401 | production up, endpoint fail-closed |
| Owner screenshots: Vercel Logs / Supabase Logs, last hour ~22:59–23:57 SGT 2026-10-02 | only `/sign-in` 200 (Vercel) and one Supabase `network-bans/retrieve` POST | window did not include 11:00–11:59 SGT; no conclusion about the cron |
| drift check | 0 dead / 201 refs | docs ↔ code |

## 4. Live handoff state
| Type | Handle / location | State | Inspect / resume | Stop / cleanup |
| --- | --- | --- | --- | --- |
| branch | `main` | 98bdc3d; this log and two doc edits uncommitted | `git status` | commit with the next session's work or on its own |
| branches | 18 local + 7 remote obsolete branches (list in `docs/sessions/2026-09-25-tooling-cleanup.md` §6) | still present | `git branch -a` | owner runs the commands in that log |
| scheduler | Vercel Cron `/api/keepalive` `0 3 * * *` (11:00–11:59 SGT) | registered; first automatic run unconfirmed | Supabase → Logs → API Gateway, Last 24 hours | remove the `crons` entry from `vercel.json` |
| deployment | Vercel production, main @ 98bdc3d, functions sin1 | live | `curl.exe -i https://lyanne-visa.vercel.app/api/keepalive` → 401 | Vercel Instant Rollback |
| data | Supabase project `cexjdjrhnextgsdgfbcr` (free, Singapore) | active | Supabase dashboard → Logs | none |
| artifact | `.claude/settings.local.json` | untracked, machine-specific | `git status` | keep untracked |

## 5. In-flight changes (from OpenSpec)
| Change | Tasks | Status | Next ready artifact |
| --- | --- | --- | --- |
| `co-parent-requests` | 0/22 | in-progress (planning complete) | awaiting owner review, then `openspec instructions apply --change "co-parent-requests" --json` |

## 6. Open items
| Priority | Item | Ref | Next action | Done when |
| --- | --- | --- | --- | --- |
| P1 | Confirm first automatic keepalive run | Supabase → Logs → API Gateway | after 12:00 SGT, Last 24 hours, find `GET /rest/v1/member?select=id&limit=1` 401 in 11:00–11:59 SGT | one automatic run seen |
| P1 | Delete obsolete branches | `docs/sessions/2026-09-25-tooling-cleanup.md` §6 | owner runs those commands | `git branch -a` shows only main and origin/main |
| P1 | Verify gbrain handover live | `~/.claude/scripts/` | open a new session while another holds the brain | new session connects without `/mcp` |
| P1 | Co-parent-requests | `openspec/changes/co-parent-requests/` | owner review, then apply | merged and live |
| P1 | Google sign-in for the family | Google Cloud Console | add family Gmail test users, or Branding + Publish | family can sign in |
| P1 | Backups to home NAS | `docs/stayover/general/setup.md` | monthly `npx supabase db dump`; delete copies >12 months | first backup captured |
| P2 | Vercel dashboard Function Region | Vercel → Settings → Functions | set default to sin1 if not done | dashboard shows sin1 |
| P2 | Custom domain | registrar, Vercel, Supabase, Google | buy domain; update Site URL/Redirect URLs, origins, `NEXT_PUBLIC_SITE_URL`, /privacy | works end-to-end |
| P2 | Fine-tuning | `docs/stayover/IMPLEMENTATION.md` | human-readable email dates, clearer "no account yet", popup transparency | in place |
| P2 | Re-run DB suite on hosted Supabase | `test/db/` | include concurrent-accept race | verified |
| P3 | gbrain upgrade | `gbrain self-upgrade` | revisit when single-writer locking changes | decision recorded |

## 7. Architecture / model changes
None.

## 8. Docs reconciled
| Doc | Change |
| --- | --- |
| `docs/stayover/STATUS.md` | keepalive "remaining check" now points at Supabase API Gateway logs, 11:00–11:59 SGT, within ~24 h |
| `docs/stayover/general/setup.md` | §7 keepalive checklist: run time in SGT, Hobby hour window, Vercel ~1 h log retention, check via Supabase |
| `docs/sessions/2026-10-03-keepalive-check-timing.md` | this log |

## 9. Drift check
`supercharge-drift` → 0 dead / 201 refs. No drift.

## 10. Files changed
`docs/stayover/STATUS.md`, `docs/stayover/general/setup.md`, this log. No code. Graph not refreshed (no code changed).

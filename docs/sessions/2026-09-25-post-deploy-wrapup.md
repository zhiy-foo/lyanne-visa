# 2026-09-25 — post-deploy-wrapup

## 0. Continuation brief

Session 5 addendum. Production is live at https://lyanne-visa.vercel.app from main 0222ab3 with PR #7 merged; CI green; all OpenSpec changes except co-parent-requests archived; no open PRs; no worktrees. Next: post-deployment phase, one session per item in §6, each starting with `/supercharge-start`. Owner to `/compact` this conversation first.

## 1. Work completed

- Repo-local git identity set to `zhiy-foo <316651674+zhiy-foo@users.noreply.github.com>` (`.git/config`); global identity (ConZee) unchanged for other projects. New commits in this repo are authored by zhiy-foo, so Vercel PR preview builds should work from the next PR.
- OpenSpec: foundation 4.4 (admin split — verified built) and stays 6.6 (stage-2 screenshots — covered by the shared gallery in docs/stayover/reviews/foundation-screens/) ticked; foundation (15 deltas), stays (12) and email-delivery (9) archived to openspec/changes/archive/2026-09-25-* with specs merged into openspec/specs/ (0222ab3).
- PR #7 merged (0222ab3): shared `src/ui/runAction.ts` makes every awaited action failure-safe ("Something went wrong. Please reload the page and try again."). Main CI run 36089169614 success (7m20s); the earlier run 36089072456 was cancelled by the workflow's `concurrency: cancel-in-progress`, not a failure.
- Last worktree removed; all branches kept (design/a-refined-navy and design/c-sunny-family are unmerged and kept on purpose).
- Process report (retrospective) written and rendered to PDF (5 pages) at `docs/reports/2026-09-25-process-report.pdf` + `.html`; owner chose to keep it local only — `docs/reports/` added to `.git/info/exclude` (not committed).
- Vercel region check: live `x-vercel-id` headers show `sin1::sin1` on dynamic routes (/sign-in) and `sin1::` on the prerendered /privacy — functions run in Singapore via `vercel.json`. The dashboard's project-default Function Region showed iad1 (it is overridden by vercel.json); owner advised to set it to sin1 too for consistency (no redeploy needed). CDN serves static files globally, so US entries in the CDN view are expected (crawlers, Vercel's screenshot service).

## 2. Decisions

| Decision | Verdict | Why |
| --- | --- | --- |
| git identity repo-local (zhiy-foo) first | yes | owner decision to isolate PR preview build fix to this repo |
| report files stay local | yes | owner decision; docs/reports/ added to .git/info/exclude |
| archive (not delete) completed OpenSpec changes | yes | they record the behaviour of the live app |
| process report content | edited | owner requested two rows removed before PDF export (kept local) |

## 3. Tests, checks, benchmarks

| Check | Result | What it proved |
| --- | --- | --- |
| PR #7 merge | main 0222ab3, CI run 36089169614 green (7m20s) | runAction wrapper merged, ready for production |
| Drift check at session start | 0 dead / 199 refs | no untracked or orphaned files on main 0222ab3 |
| Vercel region query | `x-vercel-id: sin1::sin1` (dynamic), `sin1::` (static) | functions pinned to Singapore; CDN global |
| Vercel dashboard Function Region | default iad1 (overridden by vercel.json sin1) | owner to set dashboard to sin1 for consistency |

## 4. Live handoff state

| Type | Handle | State | Inspect / resume |
| --- | --- | --- | --- |
| branch | main | 0222ab3 synced with origin | `git status` |
| Vercel | production deployment | 0222ab3, Ready, functions sin1 | https://lyanne-visa.vercel.app/sign-in; `curl -sI https://lyanne-visa.vercel.app/sign-in \| grep -i x-vercel-id` |
| Hosted DB | Supabase migrations | 000100–001400 applied | `npx supabase migration list` |
| Vercel env vars | 8 from .env.local | set, NEXT_PUBLIC_SITE_URL = https://lyanne-visa.vercel.app | Vercel dashboard Settings |
| Vercel project settings | Function Region default | iad1 (overridden by vercel.json) → owner to set to sin1 | Vercel dashboard Project → Settings → Functions |
| Google OAuth | Test app | Testing status; origins set to https://lyanne-visa.vercel.app, http://localhost:3000 | Google Cloud Console OAuth 2.0 credentials |
| Worktree | none | all removed | `git worktree list` |
| OpenSpec | co-parent-requests | 0/22 in-progress, awaiting owner review | openspec/changes/co-parent-requests/ |

## 5. In-flight changes (from OpenSpec)

| Change | Tasks | Status | Next ready artifact |
| --- | --- | --- | --- |
| co-parent-requests | 0/22 | in-progress | awaiting owner review |

## 6. Open items — post-deployment sessions

| Priority | Item | Doc/code reference | Next action | Done when |
| --- | --- | --- | --- | --- |
| P1 | Google sign-in for the family | https://lyanne-visa.vercel.app | add family Gmail addresses as test users, OR complete Branding (Vercel dashboard) + Publish app (Google Console) | family can sign in |
| P1 | Co-parent-requests | openspec/changes/co-parent-requests/ | owner reviews spec; if approved, build (openspec apply) | change merged and live |
| P1 | Backups to home NAS | docs/stayover/general/setup.md | set up monthly `npx supabase db dump` routine; delete copies >12 months old (matches /privacy) | first backup captured |
| P1 | Uptime ping for free Supabase | (docs/stayover/IMPLEMENTATION.md) | add cron job or scheduler to prevent idle pause when app inactive | ping running 24/7 |
| P2 | Confirm Vercel PR previews now build | github.com/zhiy-foo/lyanne-visa | trigger next PR (zhiy-foo author should now generate preview) | next PR has preview build |
| P2 | Custom domain | domain registrar + Vercel + Supabase | buy domain; update Supabase Site URL/Redirect URLs, Google origins, NEXT_PUBLIC_SITE_URL, /privacy links | domain resolves and works end-to-end |
| P2 | Fine-tuning | docs/stayover/IMPLEMENTATION.md | human-readable email dates, clearer "no account yet" message, popup transparency | features in place |
| P2 | Re-run DB suite on hosted Supabase | test/db/ | includes concurrent-accept race (not exercised in PGlite) | race condition verified safe |

## 7. Architecture / model changes

No new or changed objects or morphisms. `runAction` (client-side Trn wrapper for every action call) is now in src/ui, replacing inline try/catch blocks. No Dat/Loc changes beyond those recorded in the deploy-live log (Vercel functions pinned to sin1 via vercel.json).

## 8. Docs reconciled

| Doc | Change |
| --- | --- |
| openspec/specs/* | merged from archived changes (foundation 4.4 ticked, stays 6.6 ticked, email-delivery complete) |
| openspec/changes/archive/2026-09-25-{foundation,stays,email-delivery} | 36 deltas total; specs merged into openspec/specs/ |
| docs/sessions/2026-09-25-post-deploy-wrapup.md | this log (addendum to session 5 deploy-live) |

**Correction note:** The 2026-09-25-design-and-deploy-prep log described foundation 4.4 as "awaits live smoke on Vercel"; 4.4 was actually the admin-area split (now verified and ticked).

## 9. Drift check

Ran at session start on main 0222ab3: **0 dead / 199 refs**. No drift.

## 10. Files changed

- **OpenSpec archive** (0222ab3): openspec/changes/archive/2026-09-25-{foundation,stays,email-delivery}/, openspec/specs/* (merged deltas)
- **Session log**: docs/sessions/2026-09-25-post-deploy-wrapup.md
- **.git/config**: repo-local git identity (zhiy-foo)
- **.git/info/exclude**: docs/reports/ added (report files local only)

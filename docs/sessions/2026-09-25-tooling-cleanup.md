# 2026-09-25 — tooling-cleanup

## 0. Continuation brief
Current state: Session 6 was a tooling and cleanup session; no app code changed. Production is unchanged at https://lyanne-visa.vercel.app (main). gbrain now runs one brain per project (`GBRAIN_HOME` = project dir, brain in `<project>/.gbrain/`) and a new launcher/hook pair hands a project's brain to the newest session that asks for it. The orchestrator CLAUDE.md now lives at user level (`~/.claude/CLAUDE.md`) so it applies to every project. co-parent-requests is still 0/22 awaiting owner review.
Next step: owner deletes the merged/obsolete branches (open item P1 below), then picks the next post-deploy item (co-parent-requests review, family Google sign-in, NAS backups or uptime ping).
Resume command/check: `/supercharge-start` (the hook frees this project's gbrain brain if another session holds it; then `/mcp` → gbrain → Reconnect if prompted).

## 1. Work completed
- Diagnosed gbrain MCP "Connection closed": PGlite brain is single-writer; an older VS Code Claude session's `gbrain serve` held the lock, so every newer session's gbrain failed at startup. Seven stale `claude.exe` processes were running (the VS Code extension leaves old processes alive when a conversation is resumed).
- Closed all older Claude sessions (owner-approved) and an orphaned test gbrain server left by a sub-agent.
- Owner confirmed gbrain is per-project (set up earlier the same day in another session: project-scoped `gbrain` MCP entries with `GBRAIN_HOME`, `.claude/settings.local.json` with `env.GBRAIN_HOME`, `<project>/.gbrain/` brain, `/.gbrain` in `.gitignore`, for lyanne-visa and investment_research).
- Built the per-project gbrain handover (all outside the repo, in `C:\Users\Connor\.claude\scripts\`):
  - `gbrain-takeover.ps1` — reads the holder PID from `<database_path>\.gbrain-lock\lock` (JSON `pid`, written by gbrain's `acquireLock()` in `src/core/pglite-lock.ts`; that PID is the `bun.exe` child), and if the holder's owning `claude.exe` is not the current session, kills the holder's `gbrain.exe` tree and waits ≤10 s for the lock to clear. Never kills a `claude.exe` or another project's gbrain. Params `-GbrainHome`, `-DryRun`, `-Quiet`.
  - `gbrain-serve.cmd` — MCP launcher: runs the takeover (`-NonInteractive -Quiet <nul >nul 2>nul`) then `gbrain.exe serve --surface verbs` with stdio passed through.
  - `free-gbrain-lock.ps1` — `UserPromptSubmit` hook (registered in `~/.claude/settings.json`); no-op unless the prompt matches `^/supercharge(-start)?(\s|$)`; runs the takeover for `$env:GBRAIN_HOME` and tells the user to `/mcp` → gbrain → Reconnect when this session does not hold the brain.
  - Project-scoped `gbrain` MCP entries in `~/.claude.json` (forward-slash project keys for lyanne-visa and investment_research) now run `cmd /c C:\Users\Connor\.claude\scripts\gbrain-serve.cmd` with `GBRAIN_HOME` unchanged. Two stale hand-written backslash-keyed duplicates (direct `gbrain.exe`, not read by Claude Code) removed; backup taken first.
- gbrain index: the lyanne-visa brain holds its 6 session logs; the 2 investment_research logs that were mistakenly captured into it were soft-deleted there (restorable for 72 h) and exist in the investment_research brain.
- `docs/STATUS.md` "In flight" column reconciled (foundation/stays/email-delivery archived → co-parent-requests 0/22).
- Orchestrator CLAUDE.md moved by the owner from `2026-09 - Vibe Coding/CLAUDE.md` to `~/.claude/CLAUDE.md`, with a new "gbrain" section; the Edit deny rule in `~/.claude/settings.json` now points at the new path.
- Vercel dashboard default Function Region: owner asked for sin1; not confirmed done this session (cannot be verified from the CLI — `vercel.json` already pins functions to sin1, so this is cosmetic).
- gbrain 0.52.2 → 0.56.2 changelog reviewed: not upgrading (see Decisions).

## 2. Decisions
| Decision | Verdict | Why |
| --- | --- | --- |
| gbrain brain scope | per-project (kept) | owner decision; one shared brain across projects discarded |
| Shared HTTP gbrain server / Postgres engine | discarded | both need a process or service running all the time |
| Close whole stale Claude sessions automatically | discarded | the hook/launcher stop only the gbrain server holding this project's brain |
| Newest session asking for a project's brain gets it | kept | owner rule: on session start or `/supercharge`/`/supercharge-start`, stop the existing holder and run in the current session |
| Customise via hook + launcher, not by editing supercharge files | kept | vendor skill/command files stay stock |
| Upgrade gbrain to 0.56.2 | not now | changes are mostly shared-brain/hosted features; nothing fixes single-writer locking; needs schema migration per brain |
| Main CLAUDE.md location | `~/.claude/CLAUDE.md` | owner wants it to apply to projects outside the Vibe Coding folder |
| Delete merged branches + both design variants | approved, pending | auto-mode permission check blocked the deletion; owner to run it |

## 3. Tests, checks, benchmarks
| Check | Result | What it proved |
| --- | --- | --- |
| `gbrain doctor` with the old lock held | `connection` FAIL: held by live PID 13652 | root cause of the MCP failure |
| `gbrain-takeover.ps1` on throwaway brains t1/t2 | dry-run named the holder; real run stopped it and freed the lock; t2 holder untouched | takeover targets only the named brain |
| `gbrain-serve.cmd` + piped MCP `initialize` (free and held brain) | one valid JSON-RPC response with `serverInfo`; diagnostics on stderr only | launcher keeps stdout clean and takes over |
| Hook prompts `hello`, `/supercharge-end` | no output, exit 0 | fast no-op path |
| Hook prompts `/supercharge-start`, `/supercharge start` | freed holder / reported "already held by this session" | trigger and same-session branch |
| `claude.exe mcp get gbrain` (both projects) | Connected, `cmd /c ...gbrain-serve.cmd`, correct `GBRAIN_HOME` | MCP entries correct |
| `supercharge-drift` | 0 dead / 199 refs | no drift |
| `npm audit --omit=dev` | 0 vulnerabilities | — |
| Main CI | green on 1c501b4 (run 36103436610) | — |

## 4. Live handoff state
| Type | Handle / location | State | Inspect / resume | Stop / cleanup |
| --- | --- | --- | --- | --- |
| branch | `main` | synced after this log's commit | `git status` | none |
| branches | 18 local + 7 remote obsolete branches (list in §6) | still present | `git branch -a` | owner runs the commands in §6 |
| process | gbrain servers | none running at session end | `tasklist \| findstr /i "gbrain bun"` | none |
| config | `C:\Users\Connor\.claude\scripts\{gbrain-takeover.ps1,gbrain-serve.cmd,free-gbrain-lock.ps1}` | in use | `pwsh -File C:\Users\Connor\.claude\scripts\gbrain-takeover.ps1 -DryRun` | none |
| config | `~/.claude.json` project `gbrain` MCP entries | launcher | `claude mcp get gbrain` from the project dir | backup `claude.json.bak` was in the session scratchpad (temporary) |
| config | `~/.claude/CLAUDE.md` | orchestrator + gbrain rule | open the file | none |
| artifact | `.claude/settings.local.json` (untracked, not ignored) | sets `GBRAIN_HOME` | `git status` | keep untracked (machine-specific) |
| data | lyanne-visa brain `.gbrain/` (git-ignored) | 6 session pages + this log | `GBRAIN_HOME=<repo> gbrain list` | soft-deleted pages `inbox/2026-09-25-af91b290`, `inbox/2026-09-25-75534cd9` purge after 72 h |
| deployment | Vercel production | unchanged, functions sin1 | `curl -sI https://lyanne-visa.vercel.app/sign-in \| grep -i x-vercel-id` | none |

## 5. In-flight changes (from OpenSpec)
| Change | Tasks | Status | Next ready artifact |
| --- | --- | --- | --- |
| `co-parent-requests` | 0/22 | in-progress (planning complete) | awaiting owner review, then apply |

## 6. Open items
| Priority | Item | Doc/code reference | Next action | Done when |
| --- | --- | --- | --- | --- |
| P1 | Delete obsolete branches | `git branch -a` | owner runs: `git branch -D chore/bump-actions design/a-refined-navy design/b-passport-paper design/c-sunny-family design/initial-architecture feat/foundation feat/privacy-page fix/action-failure-busy fix/auth-redirect-hardening fix/contacts-tip-hydration worktree-agent-a140099d26e9940d4 worktree-agent-a18fa8a9b1ad95a5d worktree-agent-a32331e26eb1cfc24 worktree-agent-a77dd4cfde5ea4d81 worktree-agent-a8cdfa87d831f3f0a worktree-agent-ab8336dea5e7af257 worktree-agent-ac48528783c9b8fcc worktree-agent-addb754ccc81e4861` then `git push origin --delete chore/bump-actions design/b-passport-paper feat/foundation feat/privacy-page fix/action-failure-busy fix/auth-redirect-hardening fix/contacts-tip-hydration` then `git fetch --prune` | `git branch -a` shows only main and origin/main |
| P1 | Verify gbrain handover live | `~/.claude/scripts/` | open a new session in this project while another holds the brain | new session's gbrain connects without `/mcp`; old session's gbrain stopped |
| P1 | Co-parent-requests | `openspec/changes/co-parent-requests/` | owner reviews spec; if approved, `openspec instructions apply --change "co-parent-requests" --json` | change merged and live |
| P1 | Google sign-in for the family | Google Cloud Console | add family Gmail test users, or finish Branding + Publish app | family can sign in |
| P1 | Backups to home NAS | `docs/stayover/general/setup.md` | monthly `npx supabase db dump`; delete copies >12 months | first backup captured |
| P1 | Uptime ping for free Supabase | `docs/stayover/IMPLEMENTATION.md` | scheduled ping so the project does not pause | ping running |
| P2 | Vercel dashboard Function Region | Vercel → Project → Settings → Functions | owner sets default Function Region to sin1 (Singapore) if not done | dashboard shows sin1 |
| P2 | Confirm Vercel PR previews build | github.com/zhiy-foo/lyanne-visa | open the next PR | preview build appears |
| P2 | Custom domain | registrar, Vercel, Supabase, Google | buy domain; update Site URL/Redirect URLs, origins, `NEXT_PUBLIC_SITE_URL`, /privacy links | domain works end-to-end |
| P2 | Fine-tuning | `docs/stayover/IMPLEMENTATION.md` | human-readable email dates, clearer "no account yet", popup transparency | features in place |
| P2 | Re-run DB suite on hosted Supabase | `test/db/` | include concurrent-accept race | race verified safe |
| P3 | gbrain upgrade | `gbrain self-upgrade` | revisit when a release changes single-writer locking | decision recorded |

## 7. Architecture / model changes
None to the app model. Tooling only: per-project gbrain (`Loc`: one `gbrain serve` process per project brain, owned by the newest session that asks).

## 8. Docs reconciled
| Doc | Change |
| --- | --- |
| `docs/STATUS.md` | "In flight" column: co-parent-requests 0/22; Delivery "—" |
| `.gitignore` | `/.gbrain` (per-project brain) |
| `docs/sessions/2026-09-25-tooling-cleanup.md` | this log |

**Correction note:** the start of this session reported only 4 of 6 lyanne-visa logs indexed in gbrain; that listing was of the old shared brain in `~/.gbrain`. The per-project lyanne-visa brain already held all 6.

## 9. Drift check
`supercharge-drift` → 0 dead / 199 refs. No drift.

## 10. Files changed
- Repo: `docs/STATUS.md`, `.gitignore`, `docs/sessions/2026-09-25-tooling-cleanup.md`
- Outside repo: `~/.claude/scripts/gbrain-takeover.ps1`, `~/.claude/scripts/gbrain-serve.cmd`, `~/.claude/scripts/free-gbrain-lock.ps1`, `~/.claude/settings.json` (UserPromptSubmit hook; deny rule path by owner), `~/.claude.json` (project gbrain MCP entries), `~/.claude/CLAUDE.md` (moved by owner)

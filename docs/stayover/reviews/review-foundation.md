# Review — foundation (OpenSpec change `foundation`)

> §4.5 / §8 checklist run against the code on branch `feat/foundation` at commit
> `7e0b3ab` (2026-09-24). Reviewer: orchestrator (not the implementing agents).
> Scope: accounts, children, homes, links, join code, admin, sign-in, routing,
> stage-1 UI. Applications, stay details and email are later changes.

## Verdict

**Pass for a local prototype; not yet verified against hosted Supabase.** Every
check below that can run without the owner's hosted project passes. The live smoke
checklist (task 5.1) is **pending** until the migrations are pushed (setup step 6).

## Checks run

| Check | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm test` | 9 files, **148 passed** (87+ PGlite DB tests, routing, error mapping, validation, auth-error mapping, UI boundary) |
| `npm run build` | compiled; routes `/`, `/sign-in`, `/auth/callback`, `/register`, `/waiting`, `/deactivated`, `/home`, `/admin`, dev gallery; `ƒ Proxy` |
| `npm run screens` | **72 passed** — every stage-1 screen × state × 390/1280 × light/dark, each asserting no horizontal overflow and ≥ 44 px tap targets |
| drift check | **0 dead / 113 refs** |
| Dummy-env smoke (`next dev`) | signed-out `/`, `/home`, `/admin`, `/register` → 307 `/sign-in?next=…`; `/sign-in` → 200 |
| Live smoke checklist (task 5.1) | **pending** — needs hosted Supabase with migrations pushed |

## §4.5 coherence laws

- [x] **1. Placement honesty** — every write is a `SECURITY DEFINER` function that
  resolves the caller from `auth.uid()` inside the same call that writes; no member
  id from the Browser is trusted (`supabase/migrations/20260924000300_foundation_functions.sql`).
- [x] **2. Transmission well-typing** — `t_command` payloads are validated in
  `src/stayover/validation.ts` before any RPC; no secret or service-role key exists in
  the code (grep: none); the join code crosses only as input and is stored as a
  bcrypt hash in `extensions`.
- [x] **3. Placement totality** — every realised Trn has a placement and an owning
  component in `docs/stayover/IMPLEMENTATION.md`.
- [x] **4. Dependency mediation** — the Browser reaches `Db` only through server
  actions and the proxy; tables are SELECT-only to `authenticated`, nothing to `anon`;
  future tables/functions start locked (tested).
- [x] **5. Composition soundness** — no composite re-describes its parts; the system
  roll-ups point at component docs.
- [x] **6. `runsAt` is a relation** — `authorize` (proxy + page guard, and RLS/DB
  functions) and time-zone validation (UI list, DB check) each recorded as two
  placements.

## Modeling smells (§3)

- [x] No parallel objects: account = `Member` + `m_role` + `m_status`; admin is a
  predicate; waiting list is a status, not a table; home directory is a projection
  of `Place`.
- [x] Deduced, not copied: `m_email` read from `auth.users`, never stored.
- [~] One declared realisation difference: the home directory is a definer
  *function*, not a view (Supabase linter) — same projection, recorded in design.md.

## Findings raised in review and resolved during the build

| Finding | Resolution |
| --- | --- |
| Test shim was stricter than real Supabase (a forgotten `revoke` would pass tests and leak live) | shim mirrors Supabase's open defaults + `service_role bypassrls`; tests prove defaults are open, then locked by migrations |
| pgcrypto lives in `extensions` on Supabase, not `public` | harness and migrations use `extensions.crypt/gen_salt` |
| Schema-scoped default privileges cannot remove Postgres's PUBLIC EXECUTE | global revoke + explicit per-function revoke; tested |
| A wrong join code raising an error would roll back the attempt counter | `register` returns `wrong_code` instead of raising; persistence tested |
| RLS hides waiting accounts from themselves, so the app can't route them | `my_account()` read function |
| Mobile top bar wrapped; waiting account offered "Deactivate"; admin rows overflowed at 390 px | fixed; overflow + tap-target assertions added to the screenshot run |
| A database error was treated as "signed out" (silent bounce) | `/sign-in?error=account-unavailable` with explanation |

## Known limits / open

1. DB suite ran on PGlite only — re-run against hosted Supabase (or Docker) before relying on it.
2. Concurrency of the last-parent/last-host locks is untestable on single-connection PGlite.
3. Live sign-in (email link, Google), RLS-backed pages and server actions are unverified end-to-end.
4. Google sign-in app is in *Testing* (listed test users only) until Branding is done — needs a public `/privacy` page.
5. Addresses > 300 chars are caught by the app layer; the DB constraint returns a generic error if bypassed.

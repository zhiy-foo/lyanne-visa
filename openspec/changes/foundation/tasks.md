# Tasks

## 1. Project setup

- [ ] 1.1 Scaffold a Next.js App Router app in TypeScript under `src/` with Tailwind CSS, ESLint and Vitest, and install every dependency later tasks need (`@supabase/supabase-js`, `@supabase/ssr`, `@electric-sql/pglite`, `@playwright/test` + Chromium, `supabase` CLI as a dev dependency); verify `npm run build`, `npm run lint` and `npm test` all succeed on the empty app
- [ ] 1.2 Initialise the Supabase CLI project (`supabase/`), add `.env.example` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`; add a PGlite database test harness (design Decision 11) that applies every migration in order onto a Supabase-compatible shim (`auth` schema with `users` and `uid()`, roles `anon` / `authenticated` / `service_role`) and can run SQL as a given user; verify a smoke test passes and `.env.local` is git-ignored
- [ ] 1.3 Write `docs/stayover/general/setup.md`: step-by-step for the user — hosted Supabase project, Gmail app password as Supabase custom SMTP, Google Cloud OAuth client (Web; scopes openid/email/profile) wired into Supabase, seeding `app_admin` with lyanne.stayovers@gmail.com via the SQL editor, Netlify site (connected to the GitHub repo) and env vars; verify every env var in `.env.example` and every design Decision 8 setting is covered

## 2. Database schema, visibility and rules

- [ ] 2.1 Migration creating `member`, `child`, `place`, `guardian`, `place_host`, `app_admin`, `app_setting`, `join_attempt` per design Decision 2 (unique `member.user_id`, role and status checks, no email column, pgcrypto enabled); verify `supabase db reset` applies cleanly
- [ ] 2.2 Add `me()`, `is_admin()`, RLS `SELECT` policies and the `place_directory` view per Decision 4; revoke direct writes from `authenticated`; verify integration tests: parent sees own children and co-parents only, host sees own places with address, parent sees directory without address, stranger sees only the directory, waiting and deactivated users see nothing, admin sees everything, a direct `INSERT` by any app user is refused
- [ ] 2.3 Add `register(role, name, code?)` (rules 1, 15, 16, 21), `set_join_code`, and admin functions `approve_member`, `decline_member`, `deactivate_member`, `reactivate_member`, `set_member_role` (rules 17, 18); verify tests: correct code ⟹ active, no code ⟹ waiting, wrong code refused without creating a member, sixth attempt after 5 wrong codes ⟹ waiting even with the right code, no code set ⟹ waiting, changing the code leaves existing members unchanged, stored value is not the plain code, empty name / invalid role / second registration / admin registering all refused, non-admin calling any admin function (incl. `set_join_code`) refused, approve ⟹ active, decline ⟹ deactivated, role change refused while linked and allowed when unlinked, reactivate restores access
- [ ] 2.4 Add `add_child`, `rename_child`, `add_guardian`, `remove_guardian`, `add_place`, `update_place`, `add_host`, `remove_host` enforcing rules 10, 11, 14, 19, 20 and the time-zone check; verify with PGlite tests one per refusal: host adds child, parent adds place, non-parent of the child links/unlinks, co-parent email not an active parent account (unknown / host / waiting), email in another letter case succeeds, last parent removal, last host removal, non-host edits place, unknown time zone, admin links a host as parent — plus a happy path per function

## 3. Sign-in, registration and routing

- [ ] 3.1 Supabase SSR clients and middleware that refreshes the session, sends signed-out visitors to `/sign-in?next=<path>`, and applies the Decision 5 routing (admin / active / waiting / deactivated / unregistered) on every page load; verify tests for each routing branch
- [ ] 3.2 `/sign-in` (email link + Google) and `/auth/callback`; verify the expired-link and cancelled-Google messages appear, and `next` is honoured after sign-in
- [ ] 3.3 `/register` (choose parent or host, display name, optional join code, wrong-code message with "try again" / "join the waiting list") calling `register`, plus `/waiting` and `/deactivated` with sign-out; verify registering with the code lands on `/home`, without it on `/waiting`, and a second visit to `/register` redirects away
- [ ] 3.4 Sign-out available on every signed-in page; verify the session ends and `/home` redirects to `/sign-in`

## 4. Pages

- [ ] 4.1 `/home` for parents (my children, co-parents, add child, add/remove co-parent, home directory) and for hosts (my homes with address, co-hosts, add/edit home, add/remove co-host), with server actions mapping database refusals to the spec messages; verify unit tests for the error mapping
- [ ] 4.2 `/admin` (waiting list with approve/decline at the top; all accounts with role, status, links; deactivate/reactivate; change role; set/change/clear join code; rename child, edit home, add/remove links); verify a non-admin request to `/admin` is refused
- [ ] 4.3 Presentational components in `src/ui/` matching the prop types in docs/stayover/general/ui-design-brief.md and styled per docs/stayover/general/design-reference.md: design tokens (light + dark) as Tailwind theme, fonts, the app shell (top bar, navigation drawer, theme toggle) and every stage-1 screen; verify a test that no file in `src/ui/` imports Supabase or server-only modules, add a dev-only `/dev/gallery` route rendering every `src/ui/` screen with fixture props (404 in production builds), and screenshot each stage-1 screen at 390px and 1280px wide in both themes into `docs/stayover/reviews/foundation-screens/` with Playwright

## 5. Verification and reconcile

- [ ] 5.1 Run the full suite, lint and build; run the manual smoke checklist against a Supabase stack (hosted project or Docker; skip and record as pending if neither is available) — admin signs in and sets the join code, a parent registers with the code and adds a child, a stranger registers without it and is declined, a host registers and adds a home, co-parent and co-host linked by email — and record results in `docs/stayover/reviews/review-foundation.md`
- [ ] 5.2 Reconcile docs: move the realised rows in `docs/stayover/IMPLEMENTATION.md` to real `file:symbol` refs with state `built` (two rows each for `authorize` and time-zone validation); update component and root STATUS; run the §4.5 checklist in the review file; verify the drift check reports 0 dead

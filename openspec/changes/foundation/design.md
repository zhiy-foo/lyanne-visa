# Design

## Context

Greenfield repo: only `docs/` (the model) and `openspec/` exist. The intended model
is docs/stayover/ARCHITECTURE.md — "Accounts, children and places" (§4), rules 1,
10–12 and 14–21, and the three permission tables — plus docs/architecture-map.md §2
for Loc/Trm. See proposal.md for scope and the two specs for required behaviour.

Constraints: free tiers only (Vercel Free, Supabase Free); anyone can register (the
join code only decides active-now vs waiting), so every privacy rule must hold in the
database, not just the UI; the visual design is fixed by docs/stayover/general/design-reference.md
(from the user's reference screenshots) and the prop contracts in
docs/stayover/general/ui-design-brief.md.

## Goals / Non-Goals

**Goals:**
- A deployable skeleton whose permission and visibility rules hold when the UI is bypassed.
- One place that enforces each rule for every write.
- Tests that prove each guard refuses, not only that happy paths pass.

**Non-Goals:**
- Screens for later stages (calendar, event brief, applications) — only the app
  shell and stage-1 screens are built here.
- Deleting accounts — the admin deactivates instead (rule 17).
- Any outbound email from the app (change 4). Supabase Auth sends sign-in links.

## Model delta (FRAMEWORK §2)

The model was revised in docs/stayover/ARCHITECTURE.md before this change; this
change realises that slice. Realised here: `m_user` (1:1), `m_name`, `m_role`,
`m_status`, `m_statusAt`, `joinCode`, deduced `m_email`, `Child` (`c_name`, `c_createdBy`), `Place`
(`p_name`, `p_address?`, `p_tz`, `p_createdBy`), spans `Guardian` and `PlaceHost`,
deduced `admin?` and `activeMember?`; Trns `register`, `addChild`, `addPlace`,
`linkGuardian`, `linkHost`, `approve`, `decline`, `deactivate`, `reactivate`,
`setRole`, `setJoinCode`, `checkJoinCode`, `authorize`.
Deferred: everything under "Application and negotiation" and "Stay details".

One realisation detail: `AdminList` is a single-column table `app_admin(email)`
rather than an environment variable, because RLS policies must evaluate `admin?`
inside the database (the admin reads everything). It is configuration, seeded at
setup, with no grants to app roles — not family data.

**§3 Consolidation check.**
- *Parent and Host* — two objects or one? Same morphisms (`m_user`, `m_name`,
  deactivation), differing only in which spans may reference them ⟹ one `Member`
  with discriminator `m_role`; no `parent`/`host` tables.
- *Admin* — not a `Member` with a third role: it has no side, no links and no
  profile data; it is a predicate on the identity. A third role value would make
  `side` and rule 11 carry a case that can never occur.
- *Home directory vs Place* — the name/time-zone listing everyone sees is a
  restricted **view** of `Place`, not a second object: same rows, fewer columns.
- *Waiting list* — not a `Registration` object beside `Member`: a waiting account has
  exactly the same morphisms as an active one, differing only in state ⟹ one
  `m_status` enum, which also absorbs deactivation (one state morphism instead of a
  status plus a nullable `deactivatedAt`).

**§4.5 coherence laws this change must keep:**
- **Law 1 (placement honesty)** — every permission check resolves the acting account
  from `auth.uid()` inside the same database call that writes; no account id from the
  Browser is trusted.
- **Law 2 (well-typed transmissions)** — `t_command` payloads are parsed and
  validated at the AppServer boundary; no service-role key exists in this change at all.
- **Law 4 (dependency mediation)** — the Browser reaches `Db` only through server
  actions; RLS and grants still hold if that is bypassed.
- **Law 6 (runsAt is a relation)** — `authorize` is placed twice (AppServer for early
  refusal and UX, Db functions + RLS as the authority); time-zone validation is
  placed twice (UI list, Db check). Both recorded as two IMPLEMENTATION rows.

## Decisions

### 1. Next.js App Router, server actions, `@supabase/ssr`
Server Components load data; server actions perform mutations; middleware refreshes
the session cookie (Next.js 16 renames middleware to `src/proxy.ts`). *Alternatives:* a separate API server (extra Loc and Trm for no
gain); browser-side Supabase queries (moves authority to the Browser, §7.2).

### 2. Tables mirror the olog
`member (id, user_id unique not null → auth.users, name, role check in
('parent','host'), status check in ('waiting','active','deactivated'), status_at)`, `child (id, name, created_by)`,
`place (id, name, address null, time_zone, created_by)`, `guardian (member_id,
child_id)`, `place_host (member_id, place_id)`, `app_admin (email primary key)`,
`app_setting (singleton: join_code_hash null)`, `join_attempt (user_id primary key,
wrong_count)`. The latter three have no grants to app roles.
No `family` table (single tenant). `m_email` is not stored: a `SECURITY DEFINER`
helper reads it from `auth.users` where needed (deduce, don't copy).

### 3. Every write is a database function; tables are read-only to app roles
`authenticated` gets `SELECT` (filtered by RLS) and no `INSERT/UPDATE/DELETE`.
Mutations are `SECURITY DEFINER` functions with a fixed `search_path`: `register`,
`add_child`, `rename_child`, `add_guardian`, `remove_guardian`, `add_place`,
`update_place`, `add_host`, `remove_host`, and admin-only `approve_member`,
`decline_member`, `deactivate_member`, `reactivate_member`, `set_member_role`,
`set_join_code`. Each resolves the caller, checks role / link / admin / active
status, enforces rules 11, 14, 15, 16, 17, 18, 19, 20, 21 and the time-zone check, and writes atomically. *Why:* one source of truth per rule, atomic
multi-row writes (child + creator's guardian link), and "last parent / last host"
checks that RLS cannot express safely under concurrency (functions lock the rows
they count). *Alternative:* RLS write policies + app checks — rejected for the same
reasons.

### 4. Read visibility through helpers and a restricted view
Helpers `me()` (caller's active member row), `is_admin()`. Policies:
- `member`: self, co-guardians of my children, co-hosts of my places; admin all.
- `child`, `guardian`: children I parent; admin all. (Hosts of places a child has
  applied to gain access in change 2.)
- `place`, `place_host`: places I host; admin all. (Parents who applied gain access
  in change 2.)
- `home_directory()` (`id, name, time_zone`), executable by every active member —
  the address-free listing parents need to apply. *Realised as a `SECURITY DEFINER`
  function rather than a view* (a definer view trips Supabase's security linter);
  same projection, same rule.
- Read functions the model implies but RLS cannot serve: `my_account()` (the
  caller's own status, needed because RLS hides waiting/deactivated accounts from
  themselves), `member_emails()` (deduced `m_email` for visible members),
  `admin_accounts()` and `join_code_is_set()` (admin only).
- Waiting and deactivated callers: `me()` returns only `ACTIVE` members ⟹ every
  policy yields no rows for them.
- Email lookup for co-parent / co-host happens inside `add_guardian` / `add_host`;
  there is no "search accounts" read path for non-admins.

### 5. Routing after sign-in
`/auth/callback` exchanges the code, then: admin ⟹ `/admin`; active member ⟹
`/home`; waiting ⟹ `/waiting`; deactivated ⟹ `/deactivated`; otherwise ⟹
`/register`. Middleware applies
the same routing to every page load so a deep link cannot skip it.

### 6. Join code
`set_join_code(code)` stores `crypt(code, gen_salt('bf'))` (pgcrypto); `null` clears
it. `register(role, name, code?)` checks `crypt(code, hash) = hash` only while the
caller's `join_attempt.wrong_count < 5`; a wrong code increments the count and
raises a "wrong code" refusal without creating the member; an empty code, no hash
set, or a count ≥ 5 creates the member as `waiting`. *Alternatives:* a plain-text
code (readable by anyone with DB access); an environment variable (the admin could
not change it from the app).

### 7. Hosting on Vercel
Vercel runs the Next.js app (server-rendered pages, server actions, middleware) as
serverless functions via its Next.js runtime; no Vercel-specific code in the app.
*Why:* the user's production deployment choice. *Alternative:* Netlify (also fine);
GitHub Pages cannot host it — static files only, no server for auth or actions.

### 8. Sign-in providers
Supabase Auth: email OTP (magic link) + Google OAuth with scopes `openid email
profile`. Custom SMTP: Gmail `smtp.gmail.com:587` with the app account's app
password. Google Cloud OAuth client type "Web"; consent screen with basic scopes only
— no verification.

### 9. Time zones
The UI offers `Intl.supportedValuesOf('timeZone')`; `add_place` / `update_place`
check `pg_timezone_names` (authoritative).

### 10. UI split for the external designer
`src/ui/` holds presentational components with exactly the prop types in
ui-design-brief.md; `src/app/` routes load data, bind server actions and render
them. A test asserts nothing in `src/ui/` imports Supabase or server-only modules.

### 11. Tests
Vitest. Docker is not available on the development machine (2026-09-24), so
database integration tests run on **PGlite** (Postgres in WASM) with a thin shim of
Supabase's `auth` schema (`auth.users`, `auth.uid()` from the
`request.jwt.claims` setting) and its roles (`anon`, `authenticated`,
`service_role`); each test switches role and claims to act as a user. The same SQL
migrations are later pushed unchanged to the hosted Supabase project, where the
smoke checklist re-verifies them. *Risk:* shim differs from real Supabase (grants on
the `auth` schema, extension availability) → keep the shim minimal and re-run the
suite against real Supabase before relying on it. Tests sign in
as seeded users (admin, two parents, two hosts, a waiting account, a deactivated
account, an unregistered stranger)
and calling tables and functions **directly with each user's credentials**. Every
refusal path in the specs gets a test that shows the refusal; boundary inputs:
role mismatch, last parent/host, email case variants, empty names, invalid time
zone, waiting and deactivated callers, second registration, join code right /
wrong / fifth wrong / absent / cleared.

## Risks / Trade-offs

- [Anyone can still register onto the waiting list] → a waiting account sees
  nothing and cannot act; the admin declines it. Until change 4 the admin is not
  emailed about new waiting accounts and should check the admin area. A leaked join
  code lets someone in as active → the admin changes the code and deactivates them.
- [Anyone can request a sign-in email to any address] → Supabase Auth rate limits
  apply; acceptable at family scale.
- [`SECURITY DEFINER` functions bypass RLS] → fixed `search_path`, caller resolved
  inside, integration test per function proving it refuses a wrong caller.
- [Gmail SMTP ~500/day, Supabase Auth email rate limits] → a family sends a handful
  of sign-in emails a week; Google sign-in needs no email.
- [Admin list only editable by SQL] → intentional; documented in setup.md.

## Migration Plan

Greenfield: `supabase db reset` locally; `supabase db push` to the hosted project;
seed `app_admin` with the admin email via the setup guide; deploy to Vercel.
Rollback: publish the previous Vercel deploy; migrations only create objects, so a
reset is safe before real data exists.

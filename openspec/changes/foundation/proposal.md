# Proposal

## Why

lyanne-visa has an agreed architecture (docs/architecture-map.md) but no code.
Every later capability — applications, negotiation, stay details, email invites —
needs somewhere to run, a signed-in account to act as, and the children and homes
that decide who is a parent and who is a host of what. This change lays that
foundation, so change 2 (applications and negotiation) can start from a working,
deployed app.

## What Changes

- New Next.js (App Router, TypeScript, Tailwind) app, deployable to Netlify free
  tier, with a local Supabase stack (Supabase CLI) for development and tests.
- Sign-in with an **email link** or **Google** (basic scopes only). Sign-in link
  emails are sent by Supabase Auth through the app's Gmail account
  (lyanne.stayovers@gmail.com, custom SMTP), because Supabase's built-in sender only
  mails project team members.
- **Self-registration with one role**: a newly signed-in person registers as a
  **parent** or a **host** with a display name. With the **family join code** the
  account is active immediately; without it, it joins a **waiting list** for the
  admin to approve or decline. One account per sign-in identity; the holder cannot
  change their role.
- **Admin account**: the deployment's admin list (seeded at setup; v1:
  lyanne.stayovers@gmail.com) marks the admin. The admin has no parent/host account,
  sees every account, child and home, sets the join code, approves or declines
  waiting accounts, deactivates/reactivates accounts, changes a role while an account
  has no links, and corrects children, homes and links.
- **Children and homes, owned by their people**: parents add their children and
  add co-parents by email; hosts add their homes (name, optional address, time zone)
  and add co-hosts by email. Every child keeps at least one parent; every home keeps
  at least one host.
- **Visibility by connection**, enforced in the database: people see only the
  children, homes and accounts they are connected to; home addresses only to that
  home's hosts and the admin (and, from change 2, to parents who applied there).
  Waiting and deactivated accounts see nothing at all.
- **Styled UI from the design reference**: the app shell (top bar, navigation
  drawer, light/dark toggle) and every stage-1 screen, built to
  docs/stayover/general/design-reference.md and the prop contracts in
  docs/stayover/general/ui-design-brief.md.

Out of scope: applications and moves (change 2), stay details and templates
(change 3), all outbound email from the app itself (change 4).

## Capabilities

### New Capabilities

- `account-access`: signing in (email link, Google), registering with one role, the
  join code and waiting list, the admin account and its account management,
  deactivated accounts, signing out.
- `children-and-homes`: parents' children and co-parents, hosts' homes and co-hosts,
  admin corrections, and who can see what.

### Modified Capabilities

None — no specs exist yet.

## Impact

- **New code roots**: `src/app/` (routes), `src/ui/` (presentational components),
  `src/stayover/` (domain and server actions), `supabase/migrations/` (schema, RLS,
  database functions).
- **Dependencies**: `next`, `react`, `tailwindcss`, `@supabase/supabase-js`,
  `@supabase/ssr`, `vitest`; Supabase CLI (dev only).
- **External setup** (by the user, guided in tasks): Supabase project, Netlify
  site, Google Cloud OAuth client with basic scopes, and the app Gmail account's
  app password — needed now for sign-in link emails, earlier than change 4.
- **Model**: docs/stayover/ARCHITECTURE.md already records the account model
  (rules 1, 10–12, 14–21); this change realises it and moves the matching
  IMPLEMENTATION.md rows from `planned` to real `file:symbol` references.

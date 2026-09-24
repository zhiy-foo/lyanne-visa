# Stayover — status

> Reconciles ARCHITECTURE.md (intent) vs IMPLEMENTATION.md (code). Updated whenever
> code changes what is done (§6.5).

## Headline

🟡 partial — foundation (registration, the join code, admin account management,
children/places and their guardian/host links, account-state routing) and now
`Application`/`Move` negotiation, home capacity, and the stage-2 screens
(Overview, Applications, Plan a stay, Application detail) are built (20 of 22
rules realised). `StayDetails`/templates (change 3) and outbound email
(`email-delivery`, built concurrently — the `StayoverEvent` port is emitted
here but has no consumer yet) remain unbuilt.

## Completeness

| Object / morphism | State | Notes |
| --- | --- | --- |
| `Member` | ✅ built | `supabase/migrations/20260924000100_foundation_schema.sql:member` |
| `Child` | ✅ built | `supabase/migrations/20260924000100_foundation_schema.sql:child` |
| `Place` | ✅ built | `supabase/migrations/20260924000100_foundation_schema.sql:place` |
| `Guardian` | ✅ built | `supabase/migrations/20260924000100_foundation_schema.sql:guardian` |
| `PlaceHost` | ✅ built | `supabase/migrations/20260924000100_foundation_schema.sql:place_host` |
| `Application` | 🟡 partial | `supabase/migrations/20260924000700_stays_schema.sql:application`; `a_details` deferred to change 3 |
| `Move` | ✅ built | `supabase/migrations/20260924000700_stays_schema.sql:move` |
| `DateRange` | ✅ built | `move.date_start`/`date_end`, `src/ui/types.ts:DateRange` |
| `StayDetails` | ⬜ unbuilt | change 3 |
| `CareNote` | ⬜ unbuilt | |
| `Handover` | ⬜ unbuilt | |
| `Flight` | ⬜ unbuilt | |
| `Contact` | ⬜ unbuilt | |
| `m_user` / `m_name` / `m_role` / `m_status` / `m_statusAt` | ✅ built | `member` columns |
| `m_email` (deduced) | ✅ built | via `my_account` / `member_emails` |
| `joinCode` | ✅ built | `app_setting.join_code_hash`, set by `set_join_code` |
| `c_name` / `c_createdBy` | ✅ built | `child` columns |
| `p_name` / `p_address?` / `p_tz` / `p_createdBy` | ✅ built | `place` columns |
| `g_member` / `g_child` | ✅ built | `guardian` |
| `ph_member` / `ph_place` | ✅ built | `place_host` |
| `side` (deduced) | ✅ built | `record_move`, `my_applications` |
| `admin?` (deduced) | ✅ built | `app_private.is_admin` |
| `activeMember?` (deduced) | ✅ built | `app_private.my_member_id` |
| `p_capacity?` | ✅ built | `place.capacity`, `set_place_capacity` |
| `register ⊸` | ✅ built | in flight was `openspec/changes/foundation/`; now landed |
| `addChild ⊸` | ✅ built | " |
| `addPlace ⊸` | ✅ built | " |
| `linkGuardian ⊸` | ✅ built | self-service (`add_guardian`/`remove_guardian`) and admin-by-id (`admin_set_guardian`) |
| `linkHost ⊸` | ✅ built | self-service (`add_host`/`remove_host`) and admin-by-id (`admin_set_host`) |
| `deactivate ⊸` | ✅ built | " |
| `reactivate ⊸` | ✅ built | " |
| `setRole ⊸` | ✅ built | " |
| `approve ⊸` / `decline ⊸` | ✅ built | " |
| `setJoinCode ⊸` / `checkJoinCode` | ✅ built | `checkJoinCode` is inline in `register`, not a standalone function — see IMPLEMENTATION.md Notes |
| `m_status` / `joinCode` | ✅ built | (see above) |
| `authorize` | ✅ built | AppServer (`proxy.ts`/`route-guard.ts`, `record_move`'s side resolution) and Db (RLS incl. `application_select`/`move_select`) |
| `validateMove` | ✅ built | `src/stayover/validateMove.ts` (Browser), `record_move` (authoritative) |
| `recordMove ⊸` | ✅ built | `record_move`, `open_application` |
| `foldStatus` | ✅ built | `app_private.fold_application` |
| `checkOverlap` | ✅ built | `record_move`'s accept branch — `for update` locks, no exclusion constraint (task 1.2 deviation) |
| `applyTemplate ⊸` | ⬜ unbuilt | change 3 |
| `saveAsTemplate ⊸` | ⬜ unbuilt | change 3 |
| `deleteApplication ⊸` | ✅ built | `delete_application` |
| `render` | ✅ built | every Stage-1 + Stage-2 screen renders (`StayDetails` sections excluded, change 3) |
| Rule 1 (Self-service registration) | ✅ built | |
| Rule 2 (Proposal shape) | ✅ built | |
| Rule 3 (Parents open) | ✅ built | |
| Rule 4 (Move legality) | ✅ built | |
| Rule 5 (Side is snapshotted) | ✅ built | |
| Rule 6 (No double-booking) | ✅ built | |
| Rule 7 (Template discriminator) | ⬜ unbuilt | change 3 |
| Rule 8 (Templates are copied, deliberately) | ⬜ unbuilt | change 3 |
| Rule 9 (Details are not negotiated) | ⬜ unbuilt | change 3 — honoured for now by having nothing to negotiate |
| Rule 10 (Owners create, the admin oversees) | ✅ built | |
| Rule 11 (Links agree with role) | ✅ built | |
| Rule 12 (Visibility is by side) | ✅ built | incl. `Application`/`Move` and the two visibility extensions |
| Rule 13 (Hard delete only while unanswered) | ✅ built | |
| Rule 14 (Every child has a parent) | ✅ built | |
| Rule 15 (The admin is not a member) | ✅ built | |
| Rule 16 (One profile per identity) | ✅ built | |
| Rule 17 (Deactivation keeps history) | ✅ built | |
| Rule 18 (Role changes are admin-only and link-free) | ✅ built | |
| Rule 19 (Emails compare case-insensitively) | ✅ built | |
| Rule 20 (Every place has a host) | ✅ built | |
| Rule 21 (Join code) | ✅ built | |
| Rule 22 (Home capacity) | ✅ built | folded into `record_move`'s accept-branch locked section, alongside rule 6 |

## Needs work

- After the first deployment — custom domain + branded Google sign-in (decided 2026-09-24): (1) buy a domain; (2) add a simple public `/privacy` page; (3) ~~switch "Sign in with Google" from the Supabase redirect flow to Google Identity Services on our own site (Google's button / One Tap returns an ID token → `supabase.auth.signInWithIdToken` with nonce), and add the site origin to the Google client's Authorized JavaScript origins~~ **done early (2026-09-24)** — `src/app/sign-in/GoogleSignIn.tsx`, falls back to the Supabase redirect flow when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is unset or the GIS script can't load; (4) complete Google Branding (home page, privacy policy, authorised domain) and brand verification, then publish the Google app out of Testing. Result: Google's screen shows "Lyanne Stayovers" instead of the Supabase project domain.
- After the first deployment — fine-tuning (decided 2026-09-24):
  - Email dates in human form, matching the app ("Fri 25 Sep → Wed 30 Sep"), instead of ISO dates ("2026-09-25 to 2026-09-30") in notice/invite subjects and bodies (`src/delivery/render-notice.ts`, `render-invite.ts`, `build-event.ts` summary).
  - Clearer message when adding a co-host/co-parent whose email has no account yet: "No host account with that email yet — ask them to sign up as a host first." (and the parent equivalent), instead of "There is no host account with that email."
  - Popup (dialog/drawer) transparency polish (deferred 2026-09-24 until main functionality and deployment are up).
- Re-run the DB suite (`test/db/*.test.ts`) against hosted Supabase — it has only run on local PGlite so far. This now specifically includes verifying the concurrent-accept race (task 1.2/7.1) that PGlite's single connection cannot exercise.
- Live sign-in smoke test against the deployed app (task 5.1): email link and Google, both providers, on the real hosted database.
- `stays` change (2026-09-24): screenshot every new stage-2 screen/state at 390px and 1280px, both themes, into `docs/stayover/reviews/stays-screens/` (tasks.md 6.6) — left undone; the owner's dev server was running during implementation so Playwright/`next dev` were not run.
- Change 3 (`StayDetails`/templates): `a_details`, `CareNote`, `Handover`, `Flight`, `Contact`, templates, rules 7–9.
- `email-delivery` (built concurrently): the only consumer of the `t_stayover_event` port this change emits (`src/stayover/events.ts`/`events.server.ts`); `src/stayover/actions/stays.ts:emitStayoverEvent` currently only logs each event.
- `co-parent-requests` (planned separately): will change how a child's guardians are looked up; this change and foundation both read guardians only through `app_private.my_child_ids()`, so are insulated from it.

## Coherence

No laws currently failing. `Application`'s own `a_details` (StayDetails, change 3)
remains the one deferred field — `application` and its fold/functions are designed
so it can be added as a 1:1 owned table later without migrating `application`
itself (design.md Decision 2).

## Open questions

- ~~**O1:** May both sides edit StayDetails freely without re-acceptance?~~ **Resolved 2026-09-23: yes** — rule 9 stands; only dates are negotiated.
- ~~**O2:** Can every family member read every application in the family (v1 assumption: yes), or only the parents and hosts involved?~~ **Resolved 2026-09-23:** parents create/read/update/delete (delete = cancel, or permanent delete only while no host has responded); hosts read/update/deny (deny = reject or cancel, never delete); nobody else sees an application. See stayover rules 12–13 and the Permissions table.
- ~~**O7:** Sign-in methods — email magic link only, or also 'Sign in with Google'?~~ **Resolved 2026-09-23:** both. Google sign-in uses a Google Cloud OAuth client with basic scopes (openid, email, profile) only — no verification, no warning screen. Either method yields a verified email.
- ~~**O8:** Account model~~ **Resolved 2026-09-23:** self-registration with one role (parent or host), active immediately; a configured admin account (lyanne.stayovers@gmail.com) manages accounts; single tenant, no Family object; home addresses shown only to the home's hosts, the admin and parents who applied there.
- ~~**O9:** Limiting open registration; hosting~~ **Resolved 2026-09-24:** family join code ⟹ active immediately, otherwise a waiting list the admin approves or declines (admin emailed from change 4); hosting on Vercel (GitHub Pages cannot run the server parts).

## Where to dig

- Model: ARCHITECTURE.md · Code map: IMPLEMENTATION.md
- In flight: `openspec/changes/` · Reviews: reviews/ · Notes: general/

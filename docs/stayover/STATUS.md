# Stayover — status

> Reconciles ARCHITECTURE.md (intent) vs IMPLEMENTATION.md (code). Updated whenever
> code changes what is done (§6.5).

## Headline

🟡 partial — foundation is built: registration, the join code, admin account
management, children/places and their guardian/host links, and the account-state
routing that gates every page (14 of 16 rules realised, `Application` untouched).
Applications (negotiation, stay details, calendar) remain unbuilt.

## Completeness

| Object / morphism | State | Notes |
| --- | --- | --- |
| `Member` | ✅ built | `supabase/migrations/20260924000100_foundation_schema.sql:member` |
| `Child` | ✅ built | `supabase/migrations/20260924000100_foundation_schema.sql:child` |
| `Place` | ✅ built | `supabase/migrations/20260924000100_foundation_schema.sql:place` |
| `Guardian` | ✅ built | `supabase/migrations/20260924000100_foundation_schema.sql:guardian` |
| `PlaceHost` | ✅ built | `supabase/migrations/20260924000100_foundation_schema.sql:place_host` |
| `Application` | ⬜ unbuilt | |
| `Move` | ⬜ unbuilt | |
| `DateRange` | ⬜ unbuilt | |
| `StayDetails` | ⬜ unbuilt | |
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
| `side` (deduced) | ⬜ unbuilt | depends on `Application` |
| `admin?` (deduced) | ✅ built | `app_private.is_admin` |
| `activeMember?` (deduced) | ✅ built | `app_private.my_member_id` |
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
| `authorize` | 🟡 partial | AppServer (`proxy.ts`/`route-guard.ts`) and Db (RLS) placements both built for `Member`/`Child`/`Place`/`Guardian`/`PlaceHost`; no per-`Application` side check yet |
| `validateMove` | ⬜ unbuilt | |
| `recordMove ⊸` | ⬜ unbuilt | |
| `foldStatus` | ⬜ unbuilt | |
| `checkOverlap` | ⬜ unbuilt | |
| `applyTemplate ⊸` | ⬜ unbuilt | |
| `saveAsTemplate ⊸` | ⬜ unbuilt | |
| `deleteApplication ⊸` | ⬜ unbuilt | |
| `render` | 🟡 partial | every Stage-1 (account/child/home) screen renders; no `Application` view yet |
| Rule 1 (Self-service registration) | ✅ built | |
| Rule 2 (Proposal shape) | ⬜ unbuilt | |
| Rule 3 (Parents open) | ⬜ unbuilt | |
| Rule 4 (Move legality) | ⬜ unbuilt | |
| Rule 5 (Side is snapshotted) | ⬜ unbuilt | |
| Rule 6 (No double-booking) | ⬜ unbuilt | |
| Rule 7 (Template discriminator) | ⬜ unbuilt | |
| Rule 8 (Templates are copied, deliberately) | ⬜ unbuilt | |
| Rule 9 (Details are not negotiated) | ⬜ unbuilt | |
| Rule 10 (Owners create, the admin oversees) | ✅ built | |
| Rule 11 (Links agree with role) | ✅ built | |
| Rule 12 (Visibility is by side) | 🟡 partial | built for `Member`/`Child`/`Place`/`Guardian`/`PlaceHost`; `Application` visibility comes in change 2 |
| Rule 13 (Hard delete only while unanswered) | ⬜ unbuilt | depends on `Application` |
| Rule 14 (Every child has a parent) | ✅ built | |
| Rule 15 (The admin is not a member) | ✅ built | |
| Rule 16 (One profile per identity) | ✅ built | |
| Rule 17 (Deactivation keeps history) | ✅ built | |
| Rule 18 (Role changes are admin-only and link-free) | ✅ built | |
| Rule 19 (Emails compare case-insensitively) | ✅ built | |
| Rule 20 (Every place has a host) | ✅ built | |
| Rule 21 (Join code) | ✅ built | |

## Needs work

- Add a simple public `/privacy` page (needed for Google Branding before publishing the Google sign-in app out of Testing).
- Re-run the DB suite (`test/db/*.test.ts`) against hosted Supabase — it has only run on local PGlite so far.
- Live sign-in smoke test against the deployed app (task 5.1): email link and Google, both providers, on the real hosted database.
- Build `Application` and everything downstream of it (rules 2–9, 13; `authorize`'s per-application case; `render` for the application views).

## Coherence

No laws currently failing. Rule 12 (Visibility is by side) and `authorize`/`render`
are advisory-partial only because `Application` does not exist yet, not because
anything built violates them.

## Open questions

- ~~**O1:** May both sides edit StayDetails freely without re-acceptance?~~ **Resolved 2026-09-23: yes** — rule 9 stands; only dates are negotiated.
- ~~**O2:** Can every family member read every application in the family (v1 assumption: yes), or only the parents and hosts involved?~~ **Resolved 2026-09-23:** parents create/read/update/delete (delete = cancel, or permanent delete only while no host has responded); hosts read/update/deny (deny = reject or cancel, never delete); nobody else sees an application. See stayover rules 12–13 and the Permissions table.
- ~~**O7:** Sign-in methods — email magic link only, or also 'Sign in with Google'?~~ **Resolved 2026-09-23:** both. Google sign-in uses a Google Cloud OAuth client with basic scopes (openid, email, profile) only — no verification, no warning screen. Either method yields a verified email.
- ~~**O8:** Account model~~ **Resolved 2026-09-23:** self-registration with one role (parent or host), active immediately; a configured admin account (lyanne.stayovers@gmail.com) manages accounts; single tenant, no Family object; home addresses shown only to the home's hosts, the admin and parents who applied there.
- ~~**O9:** Limiting open registration; hosting~~ **Resolved 2026-09-24:** family join code ⟹ active immediately, otherwise a waiting list the admin approves or declines (admin emailed from change 4); hosting on Netlify (GitHub Pages cannot run the server parts).

## Where to dig

- Model: ARCHITECTURE.md · Code map: IMPLEMENTATION.md
- In flight: `openspec/changes/` · Reviews: reviews/ · Notes: general/

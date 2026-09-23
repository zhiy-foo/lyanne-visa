# Stayover — implementation map

> The functor ARCHITECTURE.md → code. Each object/morphism → the file:symbol that
> realises it. Keep in sync WITH the code (§6.3): a new morphism gets a row here in
> the same change that adds its code.

## Objects (Dat) → code

| Object | Form / shape | Realised at | State |
| --- | --- | --- | --- |
| `Member` | account profile with one role (parent or host), active immediately | `supabase/migrations/20260924000100_foundation_schema.sql:member` | built |
| `Child` | the child staying over | `supabase/migrations/20260924000100_foundation_schema.sql:child` | built |
| `Place` | location where stays occur | `supabase/migrations/20260924000100_foundation_schema.sql:place` | built |
| `Guardian` | span: member (parent) is guardian of child | `supabase/migrations/20260924000100_foundation_schema.sql:guardian` | built |
| `PlaceHost` | span: member (host) hosts at place | `supabase/migrations/20260924000100_foundation_schema.sql:place_host` | built |
| `Application` | child × place × Move* × StayDetails | `src/stayover/` | planned |
| `Move` | negotiation log entry: kind × side × by × at × dates? × note? | `src/stayover/` | planned |
| `DateRange` | start date, end date; nights = [start, end) | `src/stayover/` | planned |
| `StayDetails` | care notes, handovers, flights, contacts; templateName? | `src/stayover/` | planned |
| `CareNote` | topic, body | `src/stayover/` | planned |
| `Handover` | drop-off/pick-up event: kind, time?, location?, by? | `src/stayover/` | planned |
| `Flight` | leg, number, from/to, departs/arrives | `src/stayover/` | planned |
| `Contact` | emergency contact: name, relationship, phone, email?, notes? | `src/stayover/` | planned |

## Morphisms (Trn / relations) → code

| Morphism | Signature | Realising code | State |
| --- | --- | --- | --- |
| `m_user` | `Member → AuthUser` | `supabase/migrations/20260924000100_foundation_schema.sql:member` (`user_id` fk to `auth.users`) | built |
| `m_email` | `Member → 𝕊` (deduced) | `supabase/migrations/20260924000300_foundation_functions.sql:my_account` and `supabase/migrations/20260924000300_foundation_functions.sql:member_emails` | built |
| `m_name` | `Member → 𝕊` | `supabase/migrations/20260924000100_foundation_schema.sql:member` (`name` column) | built |
| `m_role` | `Member → {PARENT, HOST}` | `supabase/migrations/20260924000100_foundation_schema.sql:member` (`role` column) | built |
| `m_status` | `Member → {WAITING, ACTIVE, DEACTIVATED}` | `supabase/migrations/20260924000100_foundation_schema.sql:member` (`status` column) and `src/stayover/routing.ts:MyAccount` | built |
| `m_statusAt` | `Member → Instant` | `supabase/migrations/20260924000100_foundation_schema.sql:member` (`status_at` column) | built |
| `joinCode` | `Settings → Secret` (hashed) | `supabase/migrations/20260924000100_foundation_schema.sql:app_setting` (`join_code_hash` column) and `supabase/migrations/20260924000300_foundation_functions.sql:set_join_code` | built |
| `c_name` | `Child → 𝕊` | `supabase/migrations/20260924000100_foundation_schema.sql:child` (`name` column) | built |
| `c_createdBy` | `Child → Member` | `supabase/migrations/20260924000100_foundation_schema.sql:child` (`created_by` column) | built |
| `p_name` | `Place → 𝕊` | `supabase/migrations/20260924000100_foundation_schema.sql:place` (`name` column) | built |
| `p_address?` | `Place → 𝕊` | `supabase/migrations/20260924000100_foundation_schema.sql:place` (`address` column) | built |
| `p_tz` | `Place → 𝕊` (IANA time zone) | `supabase/migrations/20260924000100_foundation_schema.sql:place` (`time_zone` column) | built |
| `p_createdBy` | `Place → Member` | `supabase/migrations/20260924000100_foundation_schema.sql:place` (`created_by` column) | built |
| `g_member`, `g_child` | `Guardian → Member`, `Guardian → Child` | `supabase/migrations/20260924000100_foundation_schema.sql:guardian` | built |
| `ph_member`, `ph_place` | `PlaceHost → Member`, `PlaceHost → Place` | `supabase/migrations/20260924000100_foundation_schema.sql:place_host` | built |
| `side` | `Member × Application → Side?` (deduced) | `src/stayover/` | planned — depends on `Application`, which does not exist yet |
| `admin?` | `AuthUser → 𝔹` (deduced) | `supabase/migrations/20260924000200_foundation_visibility.sql:is_admin` | built |
| `activeMember?` | `AuthUser → Member` (deduced, partial) | `supabase/migrations/20260924000200_foundation_visibility.sql:my_member_id` | built |
| `a_child` | `Application → Child` | `src/stayover/` | planned |
| `a_place` | `Application → Place` | `src/stayover/` | planned |
| `a_createdBy` | `Application → Member` | `src/stayover/` | planned |
| `a_createdAt` | `Application → Instant` | `src/stayover/` | planned |
| `a_moves` | `Application → Move*` | `src/stayover/` | planned |
| `a_details` | `Application → StayDetails` | `src/stayover/` | planned |
| `mv_kind` | `Move → {PROPOSE, ACCEPT, REJECT, CANCEL}` | `src/stayover/` | planned |
| `mv_side` | `Move → {PARENT, HOST}` | `src/stayover/` | planned |
| `mv_by` | `Move → Member` | `src/stayover/` | planned |
| `mv_at` | `Move → Instant` | `src/stayover/` | planned |
| `mv_dates?` | `Move → DateRange` | `src/stayover/` | planned |
| `mv_note?` | `Move → 𝕊` | `src/stayover/` | planned |
| `dr_start`, `dr_end` | `DateRange → Date` | `src/stayover/` | planned |
| `open?` | `Application → Move` (deduced) | `src/stayover/` | planned |
| `awaiting?` | `Application → Side` (deduced) | `src/stayover/` | planned |
| `agreed?` | `Application → DateRange` (deduced) | `src/stayover/` | planned |
| `dates` | `Application → DateRange` (deduced) | `src/stayover/` | planned |
| `status` | `Application → Status` (deduced) | `src/stayover/` | planned |
| `revision` | `Application → ℕ` (deduced) | `src/stayover/` | planned |
| `sd_templateFor?` | `StayDetails → Child` | `src/stayover/` | planned |
| `sd_templateName?` | `StayDetails → 𝕊` | `src/stayover/` | planned |
| `sd_notes` | `StayDetails → CareNote*` | `src/stayover/` | planned |
| `sd_handovers` | `StayDetails → Handover*` | `src/stayover/` | planned |
| `sd_flights` | `StayDetails → Flight*` | `src/stayover/` | planned |
| `sd_contacts` | `StayDetails → Contact*` | `src/stayover/` | planned |
| `cn_topic`, `cn_body` | `CareNote → 𝕊` | `src/stayover/` | planned |
| `ho_kind` | `Handover → {DROP_OFF, PICK_UP}` | `src/stayover/` | planned |
| `ho_time?` | `Handover → TimeOfDay` | `src/stayover/` | planned |
| `ho_location?` | `Handover → 𝕊` | `src/stayover/` | planned |
| `ho_by?` | `Handover → 𝕊` | `src/stayover/` | planned |
| `ho_date` | `Handover → Date` (deduced) | `src/stayover/` | planned |
| `fl_leg` | `Flight → {OUTBOUND, RETURN}` | `src/stayover/` | planned |
| `fl_number` | `Flight → 𝕊` | `src/stayover/` | planned |
| `fl_from`, `fl_to` | `Flight → 𝕊` | `src/stayover/` | planned |
| `fl_departs`, `fl_arrives` | `Flight → ZonedDateTime` | `src/stayover/` | planned |
| `ct_name`, `ct_relationship`, `ct_phone` | `Contact → 𝕊` | `src/stayover/` | planned |
| `ct_email?`, `ct_notes?` | `Contact → 𝕊` | `src/stayover/` | planned |
| `register ⊸` | `AuthUser × (role, name) → Member` | `supabase/migrations/20260924000300_foundation_functions.sql:register` and `src/stayover/actions/register.ts:register` | built |
| `addChild ⊸` | `Member × … → Child` (creator linked) | `supabase/migrations/20260924000300_foundation_functions.sql:add_child` and `src/stayover/actions/parent.ts:addChild` | built |
| `addPlace ⊸` | `Member × … → Place` (creator linked) | `supabase/migrations/20260924000300_foundation_functions.sql:add_place` and `src/stayover/actions/host.ts:addHome` | built |
| `linkGuardian ⊸` | `Member × Member × Child → Guardian` | `supabase/migrations/20260924000300_foundation_functions.sql:add_guardian`, `supabase/migrations/20260924000300_foundation_functions.sql:remove_guardian`, `supabase/migrations/20260924000300_foundation_functions.sql:admin_set_guardian` and `src/stayover/actions/parent.ts:addCoParent`, `src/stayover/actions/parent.ts:removeParent`, `src/stayover/actions/admin.ts:linkParent` | built |
| `linkHost ⊸` | `Member × Member × Place → PlaceHost` | `supabase/migrations/20260924000300_foundation_functions.sql:add_host`, `supabase/migrations/20260924000300_foundation_functions.sql:remove_host`, `supabase/migrations/20260924000300_foundation_functions.sql:admin_set_host` and `src/stayover/actions/host.ts:addCoHost`, `src/stayover/actions/host.ts:removeHost`, `src/stayover/actions/admin.ts:linkHost` | built |
| `approve ⊸` | `Member → Member` (admin only; WAITING → ACTIVE) | `supabase/migrations/20260924000300_foundation_functions.sql:approve_member` and `src/stayover/actions/admin.ts:approveMember` | built |
| `decline ⊸` | `Member → Member` (admin only; WAITING → DEACTIVATED) | `supabase/migrations/20260924000300_foundation_functions.sql:decline_member` and `src/stayover/actions/admin.ts:declineMember` | built |
| `deactivate ⊸` | `Member → Member` (admin only) | `supabase/migrations/20260924000300_foundation_functions.sql:deactivate_member` and `src/stayover/actions/admin.ts:deactivateMember` | built |
| `reactivate ⊸` | `Member → Member` (admin only) | `supabase/migrations/20260924000300_foundation_functions.sql:reactivate_member` and `src/stayover/actions/admin.ts:reactivateMember` | built |
| `setRole ⊸` | `Member → Member` (admin only) | `supabase/migrations/20260924000300_foundation_functions.sql:set_member_role` and `src/stayover/actions/admin.ts:setMemberRole` | built |
| `setJoinCode ⊸` | `𝕊 → Settings` (admin only; stores hash) | `supabase/migrations/20260924000300_foundation_functions.sql:set_join_code` and `src/stayover/actions/admin.ts:setJoinCode` | built |
| `checkJoinCode` | `Member × 𝕊 → 𝔹` (attempt-limited) | `supabase/migrations/20260924000300_foundation_functions.sql:register` (the code-check branch inside `register`, not a separate function — see Notes) | built |
| `authorize` (AppServer placement) | `Member × Application → Side?` | `src/proxy.ts:proxy` and `src/stayover/route-guard.ts:requireAccountForPath` | partial — realised for page-level routing by member state; no per-`Application` side check yet (`Application` unbuilt) |
| `authorize` (Db placement) | `Member × Application → Side?` | `supabase/migrations/20260924000200_foundation_visibility.sql:member_select` (and its siblings `child_select`, `guardian_select`, `place_select`, `place_host_select`) | partial — RLS enforces visibility-by-side for `Member`/`Child`/`Place`/`Guardian`/`PlaceHost`; no `Application` row-level policy yet |
| `validateMove` | `Move* × MoveCmd × Side → Move` or error | `src/stayover/` | planned |
| `recordMove ⊸` | `Application × Move → Application` (append) | `src/stayover/` | planned |
| `foldStatus` | `Move* → (Status, open?, agreed?, revision)` | `src/stayover/` | planned |
| `checkOverlap` | `Child × DateRange → 𝔹` | `src/stayover/` or `supabase/migrations/` | planned |
| `applyTemplate ⊸` | `StayDetails → StayDetails` (copy) | `src/stayover/` | planned |
| `saveAsTemplate ⊸` | `StayDetails → StayDetails` (copy) | `src/stayover/` | planned |
| `deleteApplication ⊸` | `Application → ApplicationDeleted` (rule 13) | `src/stayover/` | planned |
| `render` | `ApplicationView → UI` | `src/ui/screens/SignIn.tsx:SignIn`, `src/ui/screens/Register.tsx:Register`, `src/ui/screens/Waiting.tsx:Waiting`, `src/ui/screens/Deactivated.tsx:Deactivated`, `src/ui/screens/ParentHome.tsx:ParentHome`, `src/ui/screens/HostHome.tsx:HostHome`, `src/ui/screens/Admin.tsx:Admin` | partial — every Stage-1 (account/child/home) screen renders; no `Application` view yet |
| `t_stayover_event` (port out) | `Stayover → Delivery`, carries `StayoverEvent = MoveCommitted ⊕ ApplicationDeleted ⊕ MemberWaiting` | `src/stayover/` | planned |
| `participants` (port out) | `Application → Member*` (deduced) | `src/stayover/` | planned |
| `calendarFacts` (port out) | `Application → (agreed?, revision, phase, p_tz, p_address?, c_name, p_name)` (deduced) | `src/stayover/` | planned |

### Read functions the model doesn't name directly

These are `SECURITY DEFINER` reads the app needs because RLS itself hides
rows from a waiting/deactivated/admin/unregistered caller, or because the
model's morphism is deduced rather than stored. Each is the concrete
realisation of a deduced morphism above — see Notes.

| Function | Signature | Realising code | State |
| --- | --- | --- | --- |
| `my_account` | `AuthUser → MyAccountRow?` (self, incl. `code_attempts_left`) | `supabase/migrations/20260924000300_foundation_functions.sql:my_account` | built |
| `member_emails` | `() → (Member, 𝕊)*` (visible subset only) | `supabase/migrations/20260924000300_foundation_functions.sql:member_emails` | built |
| `admin_accounts` | `() → AccountRow*` (admin only) | `supabase/migrations/20260924000300_foundation_functions.sql:admin_accounts` | built |
| `home_directory` | `() → (Place.id, Place.name, Place.time_zone)*` (address-free) | `supabase/migrations/20260924000200_foundation_visibility.sql:home_directory` | built |
| `join_code_is_set` | `() → 𝔹` (admin only) | `supabase/migrations/20260924000400_join_code_status.sql:join_code_is_set` | built |

### Time-zone validation

| What | Realising code | State |
| --- | --- | --- |
| UI: the list of choices offered | `src/app/home/page.tsx:HomePage` and `src/app/admin/page.tsx:AdminPage` (both call `Intl.supportedValuesOf`) | built |
| Db: the authoritative check | `supabase/migrations/20260924000300_foundation_functions.sql:is_valid_time_zone` | built |

## Composition rules → where enforced

| Rule (ARCHITECTURE §6) | Enforced at | Tested at | State |
| --- | --- | --- | --- |
| 1. Self-service registration | `supabase/migrations/20260924000300_foundation_functions.sql:register` and `src/stayover/actions/register.ts:register` | `test/db/functions.test.ts` — describe "register / join code", e.g. "correct code creates an active member" | built |
| 2. Proposal shape | `src/stayover/` | — | planned |
| 3. Parents open | `src/stayover/` | — | planned |
| 4. Move legality | `src/stayover/` | — | planned |
| 5. Side is snapshotted | `src/stayover/` | — | planned |
| 6. No double-booking | `src/stayover/` or `supabase/migrations/` | — | planned |
| 7. Template discriminator | `src/stayover/` | — | planned |
| 8. Templates are copied, deliberately | `src/stayover/` | — | planned |
| 9. Details are not negotiated | `src/stayover/` | — | planned |
| 10. Owners create, the admin oversees | `supabase/migrations/20260924000300_foundation_functions.sql:add_child`, `supabase/migrations/20260924000300_foundation_functions.sql:add_place`, `supabase/migrations/20260924000300_foundation_functions.sql:rename_child`, `supabase/migrations/20260924000300_foundation_functions.sql:update_place` | `test/db/functions.test.ts` — "add_child: active parent becomes the child's guardian"; "rename_child by the admin succeeds" | built |
| 11. Links agree with role | `supabase/migrations/20260924000300_foundation_functions.sql:add_guardian`, `supabase/migrations/20260924000300_foundation_functions.sql:add_host`, `supabase/migrations/20260924000300_foundation_functions.sql:admin_set_guardian`, `supabase/migrations/20260924000300_foundation_functions.sql:admin_set_host` | `test/db/functions.test.ts` — "admin cannot link a host account as a child's parent (link_role_mismatch)"; "admin cannot link a parent account as a place's host (link_role_mismatch)" | built |
| 12. Visibility is by side | `supabase/migrations/20260924000200_foundation_visibility.sql:member_select` (and `child_select`, `guardian_select`, `place_select`, `place_host_select`, `home_directory`) | `test/db/visibility.test.ts` — "P1 sees C1, its guardian rows, and members P1+P2 only"; "waiting, deactivated and unregistered identities see zero rows everywhere and no home directory" | partial — realised for `Member`/`Child`/`Place`/`Guardian`/`PlaceHost`; `Application` visibility is not built (comes in change 2) |
| 13. Hard delete only while unanswered | `src/stayover/` and `supabase/migrations/` (RLS) | — | planned — depends on `Application`, which does not exist yet |
| 14. Every child has a parent | `supabase/migrations/20260924000300_foundation_functions.sql:remove_guardian` and `supabase/migrations/20260924000300_foundation_functions.sql:admin_set_guardian` | `test/db/functions.test.ts` — "removing a child's last parent is refused (last_parent)" | built |
| 15. The admin is not a member | `supabase/migrations/20260924000300_foundation_functions.sql:register` (`admin_cannot_register` check) | `test/db/functions.test.ts` — "admin cannot register (admin_cannot_register)" | built |
| 16. One profile per identity | `supabase/migrations/20260924000300_foundation_functions.sql:register` (`already_registered` check) and `supabase/migrations/20260924000100_foundation_schema.sql:member` (`user_id` unique) | `test/db/functions.test.ts` — "registering twice is refused (already_registered)" | built |
| 17. Deactivation keeps history | `supabase/migrations/20260924000300_foundation_functions.sql:deactivate_member` and `supabase/migrations/20260924000300_foundation_functions.sql:reactivate_member` | `test/db/functions.test.ts` — "deactivate_member moves active to deactivated"; "reactivate_member moves deactivated to active, restoring exactly the access the role/links give" | built |
| 18. Role changes are admin-only and link-free | `supabase/migrations/20260924000300_foundation_functions.sql:set_member_role` | `test/db/functions.test.ts` — "set_member_role is refused while the account has links (role_change_has_links)"; "set_member_role succeeds once the account is unlinked" | built |
| 19. Emails compare case-insensitively | `supabase/migrations/20260924000300_foundation_functions.sql:add_guardian` and `supabase/migrations/20260924000300_foundation_functions.sql:add_host` (`lower()` on both sides) | `test/db/functions.test.ts` — "add_guardian links a registered active parent by email, case-insensitive"; "add_host links a registered active host by email, case-insensitive" | built |
| 20. Every place has a host | `supabase/migrations/20260924000300_foundation_functions.sql:remove_host` and `supabase/migrations/20260924000300_foundation_functions.sql:admin_set_host` | `test/db/functions.test.ts` — "removing a place's last host is refused (last_host)" | built |
| 21. Join code: hashed, 5 wrong attempts then waiting list only; no code set ⟹ everyone waits | `supabase/migrations/20260924000300_foundation_functions.sql:register` and `supabase/migrations/20260924000300_foundation_functions.sql:set_join_code` | `test/db/functions.test.ts` — "the attempt counter persists across calls: after 5 wrong codes, the 6th attempt waits even with the right code"; "no code set at all creates a waiting member even though a code was entered"; `test/db/join-code-status.test.ts` — "reports true once the admin sets a code" | built |

## Notes / divergences

- **Home directory is a function, not a view.** design.md Decision 4 named a
  view; `supabase/migrations/20260924000200_foundation_visibility.sql:home_directory`
  is a `SECURITY DEFINER` function instead — a `security_invoker = false` view
  over `place` filtered by a function call trips Supabase's
  security-definer-view lint even though the function itself is intentionally
  definer, and the function gives the identical read (id, name, time_zone; no
  address).
- **`proxy.ts` replaces `middleware.ts`.** Next.js 16 renamed the
  "run code before a route renders" file from `middleware.js` to `proxy.js`;
  `src/proxy.ts:proxy` is that file, not a Stayover-specific naming choice.
- **`checkJoinCode` has no standalone function.** The code-check logic (wrong
  code increments `join_attempt` and returns `wrong_code` without raising, so
  the increment survives; right code activates; exhausted/blank/unset code
  waits) is inlined in `register` (`supabase/migrations/20260924000300_foundation_functions.sql:register`)
  because it must run atomically with member creation — there is no
  independent read for "is this code correct" for the app to call. If a
  standalone `check_join_code` becomes useful later, extract it then.
- **`authorize`'s signature outgrew what is built.** ARCHITECTURE's signature
  (`Member × Application → Side?`) is about per-`Application` authorization,
  which does not exist yet. What is built today is the state-machine
  authorization every page already needs — which member state may see which
  route (`src/proxy.ts:proxy`, `src/stayover/route-guard.ts:requireAccountForPath`)
  — and RLS's row-level authorization for the five family tables. Both rows
  above are marked `partial` for this reason; they will pick up the
  `Application`-specific case in change 2.
- **The read functions in "Read functions the model doesn't name directly"**
  (`my_account`, `member_emails`, `admin_accounts`, `home_directory`,
  `join_code_is_set`) are realisations of the deduced morphisms
  `activeMember?`/`m_email`/the admin-only account view — RLS alone cannot
  express them (there is no email column on `member`, and a
  waiting/deactivated/admin/unregistered caller is invisible to every
  RLS-composed read), so each is a narrow `SECURITY DEFINER` function that
  resolves the caller from `auth.uid()` itself.
- **Tests run on PGlite, not yet re-run on hosted Supabase.** `test/db/*.test.ts`
  exercise every migration above through a local PGlite instance (see
  `test/db/harness.test.ts`); they have not yet been re-run against a real,
  migrated hosted Supabase project (STATUS.md tracks this as outstanding
  work).

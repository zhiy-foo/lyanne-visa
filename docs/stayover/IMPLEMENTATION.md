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
| `Application` | child × place × Move* × StayDetails | `supabase/migrations/20260924000700_stays_schema.sql:application` | partial — `a_details`/`StayDetails` deferred to change 3 |
| `Move` | negotiation log entry: kind × side × by × at × dates? × note? | `supabase/migrations/20260924000700_stays_schema.sql:move` | built |
| `DateRange` | start date, end date; nights = [start, end) | `supabase/migrations/20260924000700_stays_schema.sql:move` (`date_start`/`date_end` columns) and `src/ui/types.ts:DateRange` | built |
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
| `m_contactsTipDismissedAt?` | `Member → Instant` (ui-design-brief.md §5 "Stage 4" contacts tip; per-account, not per-browser) | `supabase/migrations/20260924001400_contacts_tip_dismissal.sql:member` (`contacts_tip_dismissed_at` column) and `supabase/migrations/20260924001400_contacts_tip_dismissal.sql:contacts_tip_dismissed` (read) | built |
| `joinCode` | `Settings → Secret` (hashed) | `supabase/migrations/20260924000100_foundation_schema.sql:app_setting` (`join_code_hash` column) and `supabase/migrations/20260924000300_foundation_functions.sql:set_join_code` | built |
| `c_name` | `Child → 𝕊` | `supabase/migrations/20260924000100_foundation_schema.sql:child` (`name` column) | built |
| `c_createdBy` | `Child → Member` | `supabase/migrations/20260924000100_foundation_schema.sql:child` (`created_by` column) | built |
| `p_name` | `Place → 𝕊` | `supabase/migrations/20260924000100_foundation_schema.sql:place` (`name` column) | built |
| `p_address?` | `Place → 𝕊` | `supabase/migrations/20260924000100_foundation_schema.sql:place` (`address` column) | built |
| `p_tz` | `Place → 𝕊` (IANA time zone) | `supabase/migrations/20260924000100_foundation_schema.sql:place` (`time_zone` column) | built |
| `p_createdBy` | `Place → Member` | `supabase/migrations/20260924000100_foundation_schema.sql:place` (`created_by` column) | built |
| `g_member`, `g_child` | `Guardian → Member`, `Guardian → Child` | `supabase/migrations/20260924000100_foundation_schema.sql:guardian` | built |
| `ph_member`, `ph_place` | `PlaceHost → Member`, `PlaceHost → Place` | `supabase/migrations/20260924000100_foundation_schema.sql:place_host` | built |
| `side` | `Member × Application → Side?` (deduced) | `supabase/migrations/20260924000900_stays_functions.sql:record_move` (inline) and `supabase/migrations/20260924001000_stays_reads.sql:my_applications` (`viewer_side`) | built |
| `admin?` | `AuthUser → 𝔹` (deduced) | `supabase/migrations/20260924000200_foundation_visibility.sql:is_admin` | built |
| `activeMember?` | `AuthUser → Member` (deduced, partial) | `supabase/migrations/20260924000200_foundation_visibility.sql:my_member_id` | built |
| `p_capacity?` | `Place → ℕ` | `supabase/migrations/20260924000700_stays_schema.sql:place` (`capacity` column) and `supabase/migrations/20260924001000_stays_reads.sql:set_place_capacity` | built |
| `a_child` | `Application → Child` | `supabase/migrations/20260924000700_stays_schema.sql:application` (`child_id` column) | built |
| `a_place` | `Application → Place` | `supabase/migrations/20260924000700_stays_schema.sql:application` (`place_id` column) | built |
| `a_createdBy` | `Application → Member` | `supabase/migrations/20260924000700_stays_schema.sql:application` (`created_by` column) | built |
| `a_createdAt` | `Application → Instant` | `supabase/migrations/20260924000700_stays_schema.sql:application` (`created_at` column) | built |
| `a_moves` | `Application → Move*` | `supabase/migrations/20260924000700_stays_schema.sql:move` (`application_id` fk) | built |
| `a_details` | `Application → StayDetails` | `src/stayover/` | planned (change 3) |
| `mv_kind` | `Move → {PROPOSE, ACCEPT, REJECT, CANCEL}` | `supabase/migrations/20260924000700_stays_schema.sql:move` (`kind` column) | built |
| `mv_side` | `Move → {PARENT, HOST}` | `supabase/migrations/20260924000700_stays_schema.sql:move` (`side` column) | built |
| `mv_by` | `Move → Member` | `supabase/migrations/20260924000700_stays_schema.sql:move` (`by` column) | built |
| `mv_at` | `Move → Instant` | `supabase/migrations/20260924000700_stays_schema.sql:move` (`at` column) | built |
| `mv_dates?` | `Move → DateRange` | `supabase/migrations/20260924000700_stays_schema.sql:move` (`date_start`/`date_end`, `move_dates_iff_propose` check) | built |
| `mv_note?` | `Move → 𝕊` | `supabase/migrations/20260924000700_stays_schema.sql:move` (`note` column) | built |
| `dr_start`, `dr_end` | `DateRange → Date` | `supabase/migrations/20260924000700_stays_schema.sql:move` (`move_date_order` check) | built |
| `open?` | `Application → Move` (deduced) | `supabase/migrations/20260924000900_stays_functions.sql:app_private.fold_application` | built |
| `awaiting?` | `Application → Side` (deduced) | `supabase/migrations/20260924000900_stays_functions.sql:app_private.fold_application` | built |
| `agreed?` | `Application → DateRange` (deduced) | `supabase/migrations/20260924000900_stays_functions.sql:app_private.fold_application` | built |
| `dates` | `Application → DateRange` (deduced) | `src/stayover/data/stays.ts:displayDates` | built |
| `status` | `Application → Status` (deduced) | `supabase/migrations/20260924000900_stays_functions.sql:app_private.fold_application` | built |
| `revision` | `Application → ℕ` (deduced) | `supabase/migrations/20260924000900_stays_functions.sql:app_private.fold_application` | built |
| `capacityStatus` | `Place × DateRange → (Date, ℕ, 𝔹)*` (deduced) | `supabase/migrations/20260924000900_stays_functions.sql:place_capacity_status` | built |
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
| `dismissContactsTip ⊸` | `Member → Member` (self only; no target id — caller resolved from `auth.uid()`, so nothing to spoof) | `supabase/migrations/20260924001400_contacts_tip_dismissal.sql:dismiss_contacts_tip` and `src/stayover/actions/stays.ts:dismissContactsTip` | built |
| `deleteMember ⊸` (rule 17 exception) | `Member → ()` (admin only; deactivated, no history only) | `supabase/migrations/20260924000600_admin_delete_member.sql:admin_delete_member` and `src/stayover/actions/admin.ts:deleteMember` | built |
| `setJoinCode ⊸` | `𝕊 → Settings` (admin only; stores hash) | `supabase/migrations/20260924000300_foundation_functions.sql:set_join_code` and `src/stayover/actions/admin.ts:setJoinCode` | built |
| `checkJoinCode` | `Member × 𝕊 → 𝔹` (attempt-limited) | `supabase/migrations/20260924000300_foundation_functions.sql:register` (the code-check branch inside `register`, not a separate function — see Notes) | built |
| `authorize` (AppServer placement) | `Member × Application → Side?` | `src/proxy.ts:proxy`, `src/stayover/route-guard.ts:requireAccountForPath` and `supabase/migrations/20260924000900_stays_functions.sql:record_move` (side resolution) | built |
| `authorize` (Db placement) | `Member × Application → Side?` | `supabase/migrations/20260924000200_foundation_visibility.sql:member_select` (and its siblings) and `supabase/migrations/20260924000800_stays_visibility.sql:application_select`, `move_select` | built |
| `validateMove` | `Move* × MoveCmd × Side → Move` or error | `src/stayover/validateMove.ts:validateMove` (Browser mirror) and `supabase/migrations/20260924000900_stays_functions.sql:record_move` (authoritative) | built |
| `recordMove ⊸` | `Application × Move → Application` (append) | `supabase/migrations/20260924000900_stays_functions.sql:record_move`, `supabase/migrations/20260924000900_stays_functions.sql:open_application` and `src/stayover/actions/stays.ts:recordMove`/`openApplication` | built |
| `foldStatus` | `Move* → (Status, open?, agreed?, revision)` | `supabase/migrations/20260924000900_stays_functions.sql:app_private.fold_application` (AppServer, via `my_applications`) and `src/stayover/validateMove.ts:computeCan` (Browser optimistic view) | built |
| `checkOverlap` | `Child × DateRange → 𝔹` | `supabase/migrations/20260924000900_stays_functions.sql:record_move` (the `accept` branch's overlap query) and `src/stayover/validateMove.ts:validateMove` (Browser mirror) | built — no exclusion constraint (task 1.2 deviation, see `supabase/migrations/20260924000700_stays_schema.sql`'s header comment; `for update` row locks instead) |
| `applyTemplate ⊸` | `StayDetails → StayDetails` (copy) | `src/stayover/` | planned (change 3) |
| `saveAsTemplate ⊸` | `StayDetails → StayDetails` (copy) | `src/stayover/` | planned (change 3) |
| `deleteApplication ⊸` | `Application → ApplicationDeleted` (rule 13) | `supabase/migrations/20260924000900_stays_functions.sql:delete_application` and `src/stayover/actions/stays.ts:deleteApplication` | built |
| `p_capacity?` write | `Place × ℕ? → Place` | `supabase/migrations/20260924001000_stays_reads.sql:set_place_capacity` and `src/stayover/actions/stays.ts:setPlaceCapacity` | built |
| `capacityStatus` read | `Place × DateRange → (Date, ℕ, 𝔹)*` | `supabase/migrations/20260924000900_stays_functions.sql:place_capacity_status` and `src/stayover/actions/stays.ts:checkCapacityWarning` | built |
| `render` | `ApplicationView → UI` | `src/ui/screens/SignIn.tsx:SignIn`, `src/ui/screens/Register.tsx:Register`, `src/ui/screens/Waiting.tsx:Waiting`, `src/ui/screens/Deactivated.tsx:Deactivated`, `src/ui/screens/ParentHome.tsx:ParentHome`, `src/ui/screens/HostHome.tsx:HostHome`, `src/ui/screens/AdminAccounts.tsx:AdminAccounts`, `src/ui/screens/AdminChildren.tsx:AdminChildren`, `src/ui/screens/AdminHomes.tsx:AdminHomes`, `src/ui/screens/Overview.tsx:Overview`, `src/ui/screens/Applications.tsx:Applications`, `src/ui/screens/PlanStay.tsx:PlanStay`, `src/ui/screens/ApplicationDetail.tsx:ApplicationDetail` | built — `StayDetails` sections (stage 3) deliberately excluded from `ApplicationDetail` |
| `t_stayover_event` (port out) | `Stayover → Delivery`, carries `StayoverEvent = MoveCommitted ⊕ ApplicationDeleted ⊕ MemberWaiting` | `src/stayover/events.ts:StayoverEvent`, `buildMoveCommittedEvent`, `buildApplicationDeletedEvent` and `src/stayover/actions/stays.ts:emitStayoverEvent` | partial — `MoveCommitted`/`ApplicationDeleted` built and firing after every commit; `MemberWaiting` is foundation's registration event, not this change's; no consumer yet (`emitStayoverEvent` logs only — `email-delivery` is the intended consumer, built concurrently) |
| `participants` (port out) | `Application → Member*` (deduced) | `supabase/migrations/20260924001000_stays_reads.sql:application_participants` and `src/stayover/events.server.ts:participants` | built |
| `calendarFacts` (port out) | `Application → (agreed?, revision, phase, p_tz, p_address?, c_name, p_name)` (deduced) | `supabase/migrations/20260924001000_stays_reads.sql:my_applications` and `src/stayover/events.server.ts:calendarFacts` | partial — `p_address?` not yet included in the read (not needed by anything built so far; add when `email-delivery` asks for it) |

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
| `admin_deletable_member_ids` | `() → uuid*` (admin only; deactivated, no history) | `supabase/migrations/20260924000600_admin_delete_member.sql:admin_deletable_member_ids` | built |
| `my_applications` | `() → ApplicationRow*` (visible-to-caller subset; realises `open?`/`awaiting?`/`agreed?`/`dates`/`status`/`revision`/`side` for the loaders) | `supabase/migrations/20260924001000_stays_reads.sql:my_applications` | built |
| `application_moves` | `Application → (Move, mover's name)*` (authorization-checked; name only, never `user_id`/email) | `supabase/migrations/20260924001000_stays_reads.sql:application_moves` | built |
| `application_participants` | `Application → (Member, email, side)*` (authorization-checked; realises `participants`, incl. email for Delivery) | `supabase/migrations/20260924001000_stays_reads.sql:application_participants` | built |

### Time-zone validation

| What | Realising code | State |
| --- | --- | --- |
| UI: the list of choices offered | `src/app/home/page.tsx:HomePage` and `src/app/admin/homes/page.tsx:AdminHomesPage` (both call `Intl.supportedValuesOf`) | built |
| Db: the authoritative check | `supabase/migrations/20260924000300_foundation_functions.sql:is_valid_time_zone` | built |

## Composition rules → where enforced

| Rule (ARCHITECTURE §6) | Enforced at | Tested at | State |
| --- | --- | --- | --- |
| 1. Self-service registration | `supabase/migrations/20260924000300_foundation_functions.sql:register` and `src/stayover/actions/register.ts:register` | `test/db/functions.test.ts` — describe "register / join code", e.g. "correct code creates an active member" | built |
| 2. Proposal shape | `supabase/migrations/20260924000700_stays_schema.sql:move` (`move_dates_iff_propose`, `move_date_order` checks) and `supabase/migrations/20260924000900_stays_functions.sql:record_move`/`open_application` (`invalid_dates` check) | `test/db/stays-functions.test.ts` — "a bad date range on a counter-proposal is refused"; "a pick-up day on or before the drop-off day is refused" | built |
| 3. Parents open | `supabase/migrations/20260924000900_stays_functions.sql:open_application` | `test/db/stays-functions.test.ts` — "an active parent guardian opens an application with a first propose move"; "a host cannot open an application" | built |
| 4. Move legality | `supabase/migrations/20260924000900_stays_functions.sql:record_move` (the `no_open_proposal`/`cannot_answer_own_proposal`/`application_closed` checks) | `test/db/stays-functions.test.ts` — "a side cannot accept its own proposal"; "no move is accepted after a terminal phase" | built |
| 5. Side is snapshotted | `supabase/migrations/20260924000700_stays_schema.sql:move` (`side` column, written once at insert, never updated — no `UPDATE` grant exists) | `test/db/stays-schema.test.ts` | built |
| 6. No double-booking | `supabase/migrations/20260924000900_stays_functions.sql:record_move` (the `accept` branch's overlap query, `for update`-locked) | `test/db/stays-functions.test.ts` — "overlapping accept is refused"; "back-to-back stays (half-open ranges) do not overlap" | built — see `checkOverlap`'s row above for the exclusion-constraint deviation |
| 7. Template discriminator | `src/stayover/` | — | planned (change 3) |
| 8. Templates are copied, deliberately | `src/stayover/` | — | planned (change 3) |
| 9. Details are not negotiated | `src/stayover/` | — | planned (change 3 — honoured for now by having nothing to negotiate yet) |
| 10. Owners create, the admin oversees | `supabase/migrations/20260924000300_foundation_functions.sql:add_child`, `supabase/migrations/20260924000300_foundation_functions.sql:add_place`, `supabase/migrations/20260924000300_foundation_functions.sql:rename_child`, `supabase/migrations/20260924000300_foundation_functions.sql:update_place` | `test/db/functions.test.ts` — "add_child: active parent becomes the child's guardian"; "rename_child by the admin succeeds" | built |
| 11. Links agree with role | `supabase/migrations/20260924000300_foundation_functions.sql:add_guardian`, `supabase/migrations/20260924000300_foundation_functions.sql:add_host`, `supabase/migrations/20260924000300_foundation_functions.sql:admin_set_guardian`, `supabase/migrations/20260924000300_foundation_functions.sql:admin_set_host` | `test/db/functions.test.ts` — "admin cannot link a host account as a child's parent (link_role_mismatch)"; "admin cannot link a parent account as a place's host (link_role_mismatch)" | built |
| 12. Visibility is by side | `supabase/migrations/20260924000200_foundation_visibility.sql:member_select` (and `child_select`, `guardian_select`, `place_select`, `place_host_select`, `home_directory`) and `supabase/migrations/20260924000800_stays_visibility.sql:application_select`, `move_select` (+ the `child_select`/`place_select` widening) | `test/db/visibility.test.ts`; `test/db/stays-visibility.test.ts` — "a guardian of the child sees the application"; "a host of the place sees it"; "an uninvolved active member sees nothing"; "a host sees the child's name only once an application exists" | built |
| 13. Hard delete only while unanswered | `supabase/migrations/20260924000900_stays_functions.sql:delete_application` | `test/db/stays-functions.test.ts` — "a parent may permanently delete an unanswered application"; "a parent cannot hard-delete once a host has responded"; "a host can never hard-delete" | built |
| 22. Home capacity | `supabase/migrations/20260924000900_stays_functions.sql:record_move` (the capacity check, folded into the same locked section as rule 6) and `supabase/migrations/20260924001000_stays_reads.sql:set_place_capacity` | `test/db/stays-functions.test.ts` — "capacity: accept exceeding capacity is refused"; "no capacity set: accepts are never refused for capacity"; `test/db/stays-reads.test.ts` — "set_place_capacity" describe block | built |
| 14. Every child has a parent | `supabase/migrations/20260924000300_foundation_functions.sql:remove_guardian` and `supabase/migrations/20260924000300_foundation_functions.sql:admin_set_guardian` | `test/db/functions.test.ts` — "removing a child's last parent is refused (last_parent)" | built |
| 15. The admin is not a member | `supabase/migrations/20260924000300_foundation_functions.sql:register` (`admin_cannot_register` check) | `test/db/functions.test.ts` — "admin cannot register (admin_cannot_register)" | built |
| 16. One profile per identity | `supabase/migrations/20260924000300_foundation_functions.sql:register` (`already_registered` check) and `supabase/migrations/20260924000100_foundation_schema.sql:member` (`user_id` unique) | `test/db/functions.test.ts` — "registering twice is refused (already_registered)" | built |
| 17. Deactivation keeps history (exception: delete a no-history deactivated member) | `supabase/migrations/20260924000300_foundation_functions.sql:deactivate_member` and `supabase/migrations/20260924000300_foundation_functions.sql:reactivate_member`; exception at `supabase/migrations/20260924000600_admin_delete_member.sql:admin_delete_member` | `test/db/functions.test.ts` — "deactivate_member moves active to deactivated"; "reactivate_member moves deactivated to active, restoring exactly the access the role/links give"; `test/db/admin-delete.test.ts` — exception cases | built |
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
- **No exclusion constraint for rule 6 (task 1.2 deviation).** `agreed?` is
  deduced by folding `move`, never a stored column, so there is no column an
  exclusion constraint could index. Concurrency safety for rule 6 and rule 22
  (capacity) instead comes entirely from `record_move` taking `select ... for
  update` locks on the child/place rows before counting — the same pattern
  foundation uses for its last-parent/last-host counts. See the header
  comment in `supabase/migrations/20260924000700_stays_schema.sql` and the
  note in `test/db/stays-functions.test.ts` (a genuine concurrent-accept race
  cannot be exercised against PGlite, which serves one connection; that
  guarantee is verified on hosted Supabase, not here).
- **UI naming predates the database's.** `src/ui/types.ts`'s `Phase` uses
  `'declined'` where the database's `fold_application`/`record_move` use
  `'rejected'`, and `Move.kind` uses `'decline'` where the database uses
  `'reject'`. The rename happens once, in `src/stayover/data/stays.ts`
  (`toUiPhase`, `toUiMoveKind`) and `src/stayover/actions/stays.ts`
  (`declineMove` calls `record_move` with `p_kind: 'reject'`) — no other file
  needs to know about it.
- **`StayoverEvent` has no consumer yet.**
  `src/stayover/actions/stays.ts:emitStayoverEvent` logs every event
  (`console.info`) rather than sending it anywhere — `email-delivery`, built
  concurrently, is the intended consumer of the `t_stayover_event` port
  (`src/stayover/events.ts`, `src/stayover/events.server.ts`). Emitting never
  blocks or fails the move/delete that triggered it (spec).
- **Tests run on PGlite, not yet re-run on hosted Supabase.** `test/db/*.test.ts`
  exercise every migration above through a local PGlite instance (see
  `test/db/harness.test.ts`); they have not yet been re-run against a real,
  migrated hosted Supabase project (STATUS.md tracks this as outstanding
  work).

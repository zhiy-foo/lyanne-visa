# Stayover — implementation map

> The functor ARCHITECTURE.md → code. Each object/morphism → the file:symbol that
> realises it. Keep in sync WITH the code (§6.3): a new morphism gets a row here in
> the same change that adds its code.

## Objects (Dat) → code

| Object | Form / shape | Realised at | State |
| --- | --- | --- | --- |
| `Member` | account profile with one role (parent or host), active immediately | `src/stayover/` | planned |
| `Child` | the child staying over | `src/stayover/` | planned |
| `Place` | location where stays occur | `src/stayover/` | planned |
| `Guardian` | span: member (parent) is guardian of child | `src/stayover/` | planned |
| `PlaceHost` | span: member (host) hosts at place | `src/stayover/` | planned |
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
| `m_user` | `Member → AuthUser` | `src/stayover/` | planned |
| `m_email` | `Member → 𝕊` (deduced) | `src/stayover/` | planned |
| `m_name` | `Member → 𝕊` | `src/stayover/` | planned |
| `m_role` | `Member → {PARENT, HOST}` | `src/stayover/` | planned |
| `m_status` | `Member → {WAITING, ACTIVE, DEACTIVATED}` | `src/stayover/` and `supabase/migrations/` | planned |
| `m_statusAt` | `Member → Instant` | `src/stayover/` | planned |
| `joinCode` | `Settings → Secret` (hashed) | `supabase/migrations/` | planned |
| `c_name` | `Child → 𝕊` | `src/stayover/` | planned |
| `c_createdBy` | `Child → Member` | `src/stayover/` | planned |
| `p_name` | `Place → 𝕊` | `src/stayover/` | planned |
| `p_address?` | `Place → 𝕊` | `src/stayover/` | planned |
| `p_tz` | `Place → 𝕊` (IANA time zone) | `src/stayover/` | planned |
| `p_createdBy` | `Place → Member` | `src/stayover/` | planned |
| `g_member`, `g_child` | `Guardian → Member`, `Guardian → Child` | `src/stayover/` | planned |
| `ph_member`, `ph_place` | `PlaceHost → Member`, `PlaceHost → Place` | `src/stayover/` | planned |
| `side` | `Member × Application → Side?` (deduced) | `src/stayover/` | planned |
| `admin?` | `AuthUser → 𝔹` (deduced) | `src/stayover/` | planned |
| `activeMember?` | `AuthUser → Member` (deduced, partial) | `src/stayover/` | planned |
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
| `register ⊸` | `AuthUser × (role, name) → Member` | `src/stayover/` | planned |
| `addChild ⊸` | `Member × … → Child` (creator linked) | `src/stayover/` | planned |
| `addPlace ⊸` | `Member × … → Place` (creator linked) | `src/stayover/` | planned |
| `linkGuardian ⊸` | `Member × Member × Child → Guardian` | `src/stayover/` | planned |
| `linkHost ⊸` | `Member × Member × Place → PlaceHost` | `src/stayover/` | planned |
| `approve ⊸` | `Member → Member` (admin only; WAITING → ACTIVE) | `src/stayover/` | planned |
| `decline ⊸` | `Member → Member` (admin only; WAITING → DEACTIVATED) | `src/stayover/` | planned |
| `deactivate ⊸` | `Member → Member` (admin only) | `src/stayover/` | planned |
| `reactivate ⊸` | `Member → Member` (admin only) | `src/stayover/` | planned |
| `setRole ⊸` | `Member → Member` (admin only) | `src/stayover/` | planned |
| `setJoinCode ⊸` | `𝕊 → Settings` (admin only; stores hash) | `src/stayover/` and `supabase/migrations/` | planned |
| `checkJoinCode` | `Member × 𝕊 → 𝔹` (attempt-limited) | `supabase/migrations/` | planned |
| `authorize` | `Member × Application → Side?` | `src/stayover/` | planned |
| `validateMove` | `Move* × MoveCmd × Side → Move` or error | `src/stayover/` | planned |
| `recordMove ⊸` | `Application × Move → Application` (append) | `src/stayover/` | planned |
| `foldStatus` | `Move* → (Status, open?, agreed?, revision)` | `src/stayover/` | planned |
| `checkOverlap` | `Child × DateRange → 𝔹` | `src/stayover/` or `supabase/migrations/` | planned |
| `applyTemplate ⊸` | `StayDetails → StayDetails` (copy) | `src/stayover/` | planned |
| `saveAsTemplate ⊸` | `StayDetails → StayDetails` (copy) | `src/stayover/` | planned |
| `deleteApplication ⊸` | `Application → ApplicationDeleted` (rule 13) | `src/stayover/` | planned |
| `render` | `ApplicationView → UI` | `src/app/` | planned |
| `t_stayover_event` (port out) | `Stayover → Delivery`, carries `StayoverEvent = MoveCommitted ⊕ ApplicationDeleted ⊕ MemberWaiting` | `src/stayover/` | planned |
| `participants` (port out) | `Application → Member*` (deduced) | `src/stayover/` | planned |
| `calendarFacts` (port out) | `Application → (agreed?, revision, phase, p_tz, p_address?, c_name, p_name)` (deduced) | `src/stayover/` | planned |

## Composition rules → where enforced

| Rule (ARCHITECTURE §6) | Enforced at | State |
| --- | --- | --- |
| 1. Self-service registration | `src/stayover/` | planned |
| 2. Proposal shape | `src/stayover/` | planned |
| 3. Parents open | `src/stayover/` | planned |
| 4. Move legality | `src/stayover/` | planned |
| 5. Side is snapshotted | `src/stayover/` | planned |
| 6. No double-booking | `src/stayover/` or `supabase/migrations/` | planned |
| 7. Template discriminator | `src/stayover/` | planned |
| 8. Templates are copied, deliberately | `src/stayover/` | planned |
| 9. Details are not negotiated | `src/stayover/` | planned |
| 10. Owners create, the admin oversees | `src/stayover/` | planned |
| 11. Links agree with role | `src/stayover/` or `supabase/migrations/` | planned |
| 12. Visibility is by side | `src/stayover/` and `supabase/migrations/` (RLS) | planned |
| 13. Hard delete only while unanswered | `src/stayover/` and `supabase/migrations/` (RLS) | planned |
| 14. Every child has a parent | `src/stayover/` | planned |
| 15. The admin is not a member | `src/stayover/` | planned |
| 16. One profile per identity | `src/stayover/` or `supabase/migrations/` | planned |
| 17. Deactivation keeps history | `src/stayover/` | planned |
| 18. Role changes are admin-only and link-free | `src/stayover/` or `supabase/migrations/` | planned |
| 19. Emails compare case-insensitively | `src/stayover/` | planned |
| 20. Every place has a host | `src/stayover/` | planned |
| 21. Join code: hashed, 5 wrong attempts then waiting list only; no code set ⟹ everyone waits | `supabase/migrations/` | planned |

## Notes / divergences

None yet — greenfield model phase.

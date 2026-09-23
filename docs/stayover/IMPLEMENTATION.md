# Stayover — implementation map

> The functor ARCHITECTURE.md → code. Each object/morphism → the file:symbol that
> realises it. Keep in sync WITH the code (§6.3): a new morphism gets a row here in
> the same change that adds its code.

## Objects (Dat) → code

| Object | Form / shape | Realised at | State |
| --- | --- | --- | --- |
| `Family` | tenant structure | `src/stayover/` | planned |
| `Member` | family member; `m_user?` null = pending invite | `src/stayover/` | planned |
| `Child` | the child staying over | `src/stayover/` | planned |
| `Place` | location where stays occur | `src/stayover/` | planned |
| `Guardian` | span: member is parent/guardian of child | `src/stayover/` | planned |
| `PlaceHost` | span: member hosts at place | `src/stayover/` | planned |
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
| `f_name` | `Family → 𝕊` | `src/stayover/` | planned |
| `m_family` | `Member → Family` | `src/stayover/` | planned |
| `m_email` | `Member → 𝕊` | `src/stayover/` | planned |
| `m_name` | `Member → 𝕊` | `src/stayover/` | planned |
| `m_user?` | `Member → AuthUser` | `src/stayover/` | planned |
| `m_invitedBy?` | `Member → Member` | `src/stayover/` | planned |
| `c_family` | `Child → Family` | `src/stayover/` | planned |
| `c_name` | `Child → 𝕊` | `src/stayover/` | planned |
| `p_family` | `Place → Family` | `src/stayover/` | planned |
| `p_name` | `Place → 𝕊` | `src/stayover/` | planned |
| `p_address?` | `Place → 𝕊` | `src/stayover/` | planned |
| `p_tz` | `Place → 𝕊` (IANA time zone) | `src/stayover/` | planned |
| `g_member`, `g_child` | `Guardian → Member`, `Guardian → Child` | `src/stayover/` | planned |
| `ph_member`, `ph_place` | `PlaceHost → Member`, `PlaceHost → Place` | `src/stayover/` | planned |
| `side` | `Member × Application → Side?` (deduced) | `src/stayover/` | planned |
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
| `sd_family` | `StayDetails → Family` | `src/stayover/` | planned |
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
| `inviteMember ⊸` | `Member × InviteCmd → Member` (pending) | `src/stayover/` | planned |
| `bindUser ⊸` | `AuthUser → Member` | `src/stayover/` | planned |
| `authorize` | `Member × Application → Side?` | `src/stayover/` | planned |
| `validateMove` | `Move* × MoveCmd × Side → Move` or error | `src/stayover/` | planned |
| `recordMove ⊸` | `Application × Move → Application` (append) | `src/stayover/` | planned |
| `foldStatus` | `Move* → (Status, open?, agreed?, revision)` | `src/stayover/` | planned |
| `checkOverlap` | `Child × DateRange → 𝔹` | `src/stayover/` or `supabase/migrations/` | planned |
| `applyTemplate ⊸` | `StayDetails → StayDetails` (copy) | `src/stayover/` | planned |
| `saveAsTemplate ⊸` | `StayDetails → StayDetails` (copy) | `src/stayover/` | planned |
| `deleteApplication ⊸` | `Application → ApplicationDeleted` (rule 13) | `src/stayover/` | planned |
| `render` | `ApplicationView → UI` | `src/app/` | planned |
| `t_stayover_event` (port out) | `Stayover → Delivery`, carries `StayoverEvent = MoveCommitted ⊕ ApplicationDeleted` | `src/stayover/` | planned |
| `participants` (port out) | `Application → Member*` (deduced) | `src/stayover/` | planned |
| `calendarFacts` (port out) | `Application → (agreed?, revision, phase, p_tz, p_address?, c_name, p_name)` (deduced) | `src/stayover/` | planned |

## Composition rules → where enforced

| Rule (ARCHITECTURE §6) | Enforced at | State |
| --- | --- | --- |
| 1. Same tenant: `c_family ∘ a_child = p_family ∘ a_place = sd_family ∘ a_details` | `src/stayover/` | planned |
| 2. Proposal shape: `mv_dates?` defined ⟺ `mv_kind = PROPOSE`; `dr_start < dr_end` | `src/stayover/` | planned |
| 3. Parents open: `a_moves[0]` is `PROPOSE` with `mv_side = PARENT` | `src/stayover/` | planned |
| 4. Move legality: `ACCEPT`/`REJECT` require `open?` defined and `mv_side ≠ mv_side(open?)` | `src/stayover/` | planned |
| 5. Side is snapshotted: `mv_side(mv) = side(mv_by(mv), a)` at write time | `src/stayover/` | planned |
| 6. No double-booking: `agreed?` ranges do not overlap for two applications of same child | `src/stayover/` or `supabase/migrations/` | planned |
| 7. Template discriminator: `sd_templateName?` defined ⟺ no `Application` has `a_details` pointing at it | `src/stayover/` | planned |
| 8. Templates are copied deliberately: applying/saving template copies child lists | `src/stayover/` | planned |
| 9. Details are not negotiated: either side may edit `StayDetails` freely while non-terminal | `src/stayover/` | planned |
| 10. Invite binding: on sign-in, `AuthUser` binds to pending `Member` once | `src/stayover/` | planned |
| 11. One side per application: no member is both `Guardian` of `a_child` and `PlaceHost` of `a_place` | `src/stayover/` | planned |
| 12. Visibility is by side (O2): A member reads an application iff `side(m, a)` is defined | `src/stayover/` and `supabase/migrations/` (RLS) | planned |
| 13. Hard delete only while unanswered (O2): parent may permanently delete iff every move has `mv_side = PARENT` | `src/stayover/` and `supabase/migrations/` (RLS) | planned |

## Notes / divergences

None yet — greenfield model phase.

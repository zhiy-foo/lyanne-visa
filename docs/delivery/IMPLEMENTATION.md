# Delivery — implementation map

> The functor ARCHITECTURE.md → code. Each object/morphism → the file:symbol that
> realises it. Keep in sync WITH the code (§6.3): a new morphism gets a row here in
> the same change that adds its code.

## Objects (Dat) → code

| Object | Form / shape | Realised at | State |
| --- | --- | --- | --- |
| `Dispatch` | delivery audit: recipient, kind, revision, attempts, status | `src/delivery/` | planned |
| `CalendarEvent` | all-day event: deduced from agreed dates, not stored | `src/delivery/` | planned (deduced) |

## Morphisms (Trn / relations) → code

| Morphism | Signature | Realising code | State |
| --- | --- | --- | --- |
| `d_member?` | `Dispatch → Member` (partial; not for admin notices) | `src/delivery/` | planned |
| `d_to` | `Dispatch → 𝕊` (recipient address) | `src/delivery/` | planned |
| `d_application?` | `Dispatch → Application` | `src/delivery/` | planned |
| `d_kind` | `Dispatch → {NOTICE, INVITE}` | `src/delivery/` | planned |
| `d_revision` | `Dispatch → ℕ` | `src/delivery/` | planned |
| `d_attempts` | `Dispatch → ℕ` | `src/delivery/` | planned |
| `d_status` | `Dispatch → {SENT, FAILED}` | `src/delivery/` | planned |
| `d_error?` | `Dispatch → 𝕊` | `src/delivery/` | planned |
| `d_at` | `Dispatch → Instant` | `src/delivery/` | planned |
| `event?` | `Application → CalendarEvent` (deduced) | `src/delivery/` | planned |
| `ev_uid` | `CalendarEvent → 𝕊` (deduced) | `src/delivery/` | planned |
| `ev_sequence` | `CalendarEvent → ℕ` (deduced) | `src/delivery/` | planned |
| `ev_method` | `CalendarEvent → {REQUEST, CANCEL}` (deduced) | `src/delivery/` | planned |
| `ev_span` | `CalendarEvent → DateRange` (deduced) | `src/delivery/` | planned |
| `ev_title` | `CalendarEvent → 𝕊` (deduced) | `src/delivery/` | planned |
| `ev_location?` | `CalendarEvent → 𝕊` (deduced) | `src/delivery/` | planned |
| `ev_organizer` | `CalendarEvent → 𝕊` (deduced) | `src/delivery/` | planned |
| `ev_attendees` | `CalendarEvent → 𝕊*` (deduced) | `src/delivery/` | planned |
| `planDelivery` | `StayoverEvent → PlannedDispatch*` (pure) | `src/delivery/` | planned |
| `buildEvent` | `calendarFacts → CalendarEvent` (pure) | `src/delivery/` | planned |
| `renderIcs` | `CalendarEvent → 𝕊` (pure, RFC 5545) | `src/delivery/` | planned |
| `renderNotice` | `StayoverEvent × Member → EmailMessage` (pure) | `src/delivery/` | planned |
| `sendEmail ⊸` | `EmailMessage → SendResult` (port `Mailer`) | `src/delivery/` | planned |
| `dispatch ⊸` | `PlannedDispatch → Dispatch` (send with bounded retry, record) | `src/delivery/` | planned |
| `t_stayover_event` (port in) | `Stayover → Delivery`, carries `StayoverEvent` | `src/delivery/` | planned |
| `participants` (read) | `Application → Member*` (deduced in Stayover) | `src/stayover/` | planned |
| `calendarFacts` (read) | `Application → (agreed?, revision, phase, …)` (deduced in Stayover) | `src/stayover/` | planned |
| `Mailer` (port) | `EmailMessage → SendResult ⊸`; adapters: Gmail SMTP, console double | `src/delivery/` | planned |

## Composition rules → where enforced

| Rule (ARCHITECTURE §6) | Enforced at | State |
| --- | --- | --- |
| 1. Deliver after commit, never inside it | `src/delivery/` | planned |
| 2. Bounded retry | `src/delivery/` | planned |
| 3. Monotone sequence | `src/delivery/` | planned |
| 4. Calendar follows agreed? only | `src/delivery/` | planned |
| 5. Stable identity | `src/delivery/` | planned |
| 6. Secrets stay server-side | `src/delivery/` | planned |
| 7. Recipients are participants | `src/delivery/` | planned |

## Notes / divergences

None yet — greenfield model phase.

# System implementation map

> Whole-system functor architecture-map.md → code, deduced from the component
> IMPLEMENTATION.md files. System-level rows only.

## Components → code root

| Component | Code root | Model | Code map |
| --- | --- | --- | --- |
| Stayover | `src/stayover/` | [stayover/ARCHITECTURE.md](stayover/ARCHITECTURE.md) | [stayover/IMPLEMENTATION.md](stayover/IMPLEMENTATION.md) |
| Delivery | `src/delivery/` | [delivery/ARCHITECTURE.md](delivery/ARCHITECTURE.md) | [delivery/IMPLEMENTATION.md](delivery/IMPLEMENTATION.md) |

## Shared objects (one Dat, DataLocs in ≥2 components)

| Object | Authoritative at | Also read by | Realised at | State |
| --- | --- | --- | --- | --- |
| `Member` | Stayover | Delivery | `src/stayover/` | planned |
| `Application` | Stayover | Delivery | `src/stayover/` | planned |

## Inter-component transmissions / ports (Trm)

| Port | carries | c_from → c_to | Realising code | State |
| --- | --- | --- | --- | --- |
| `t_stayover_event` | `StayoverEvent = MoveCommitted ⊕ ApplicationDeleted ⊕ MemberWaiting` | Stayover → Delivery | `src/delivery/` | planned |
| `participants` | `Member*` (deduced) | Stayover → Delivery | `src/stayover/` | planned |
| `calendarFacts` | `(agreed?, revision, phase, p_tz, p_address?, c_name, p_name)` | Stayover → Delivery | `src/stayover/` | planned |
| `Mailer` | `EmailMessage → SendResult ⊸` | Delivery → MailProvider (Gmail SMTP) | `src/delivery/` | planned |

## System entry points

None yet — greenfield. Will include HTTP endpoints, server actions once built.

## Divergences (system-level)

None yet — greenfield model phase.

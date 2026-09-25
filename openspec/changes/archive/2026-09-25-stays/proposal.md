# Proposal

## Why

Foundation (accounts, children, homes) is built; `Application` — the actual point
of the app — is not. Without it, nobody can ask for a stay, nobody can answer, and
nothing is ever confirmed. This change builds the negotiation itself (the append-only
move log and its deduced status), the optional home-capacity limit the owner decided
on 2026-09-24, and the stage-2 screens, so a parent can plan a stay and a host can
answer it end to end. Stay details (care notes, handovers, flights, contacts,
templates) and outbound email are deliberately out of scope — they are change 3 and
change 4 (`email-delivery`, proposed alongside this one) respectively.

## What Changes

- **`Application` and the move log**: a parent opens an application (child, place,
  proposed dates, optional note); either side can `PROPOSE` (counter), `ACCEPT`,
  `REJECT` or `CANCEL`; status, whose turn it is, and the agreed dates are folded
  from the log, never stored (ARCHITECTURE.md §5, rules 2–5).
- **Negotiation rules 2–8, 10–13** as they apply to dates and moves (rule 9 — stay
  details are not negotiated — is honoured by having nothing to negotiate yet;
  rules 7–8, template mechanics, stay out of scope since `a_details`/templates are
  change 3).
- **No double-booking** (rule 6): two agreed stays for the same child never overlap;
  enforced at `ACCEPT`.
- **Hard delete only while unanswered** (rule 13): a parent may permanently delete
  an application no host has responded to; otherwise "delete" is `CANCEL`.
- **Either side may cancel**, before or after confirmation; the admin reads every
  application but never acts on one.
- **Optional home capacity** — `p_capacity?` ("How many children can you host at
  once?", blank = no limit), editable by a place's hosts/admin, enforced on
  `ACCEPT` (no night may exceed capacity counting children with agreed stays there)
  with a warning shown to a parent proposing dates on an already-full night.
- **Visibility extensions** (foundation design Decision 4): hosts of a place see
  the children with applications there; parents who applied to a place see its
  address. Host-facing screens reveal a child's real name only once an application
  links them (decided 2026-09-24).
- **Stage-2 UI**: Overview (greeting, attention banner, month calendar), an
  Applications list (needs-your-answer / upcoming / past), a Plan a stay form
  (parents), and the Application detail screen (the Event brief minus stage-3
  sections) — per docs/stayover/general/design-reference.md and
  docs/stayover/general/ui-design-brief.md §5 "Stage 2". Nav grows to "Overview ·
  Applications · Plan a stay · My children" (parents) / "Overview · Applications ·
  My home" (hosts).
- **`StayoverEvent` port**: emits `MoveCommitted` and `ApplicationDeleted` for
  `email-delivery` to consume (ARCHITECTURE.md §8); this change defines and emits
  the event, it does not send anything.

Out of scope: `StayDetails` content, handovers, flights, contacts and templates
(change 3, rules 7–9's template half); all outbound email and calendar invites
(change `email-delivery`); co-parent/guardian semantics changes (a separate,
already-planned change, `co-parent-requests`, will later touch guardian lookups —
this change reads guardians only through the existing `app_private.my_child_ids()`
helper so it is insulated from that).

## Capabilities

### New Capabilities

- `stays`: applications, the move log, deduced status/turn/agreed dates, no
  double-booking, hard delete while unanswered, home capacity, application
  visibility, and the stage-2 screens.

### Modified Capabilities

None — this change only adds the `Application` object and its behaviour; it does
not change any requirement in `account-access` or `children-and-homes` (it reads
`app_private.my_child_ids()` and place/host data as those capabilities already
expose them, and extends `Place` with an optional field rather than changing an
existing requirement).

## Impact

- **New code**: `supabase/migrations/` (application, move, capacity schema +
  functions); `src/stayover/` (validateMove, recordMove, foldStatus, checkOverlap,
  application actions/data loaders, the `StayoverEvent` emission); `src/ui/screens/`
  (Overview, ApplicationsList, PlanAStay, ApplicationDetail) and their fixtures.
- **Schema**: new `application`, `move` tables; `place.capacity` (nullable int).
- **Dependents**: `email-delivery` consumes the `StayoverEvent` port defined here;
  no code in this change calls into delivery (Law 4 — dependency mediation stays
  one-directional).

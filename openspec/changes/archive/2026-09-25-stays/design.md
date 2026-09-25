# Design

## Context

See proposal.md for motivation. The intended model is
docs/stayover/ARCHITECTURE.md §3–4 ("Application and negotiation"), §5 (the
negotiation state machine), §6 rules 2–13 and 17, the permission tables, and §8
(ports to Delivery); STATUS.md "Needs work" for the two owner decisions this
change realises (capacity, named-host-copy). Foundation
(openspec/changes/foundation/) already built `Member`, `Child`, `Place`,
`Guardian`, `PlaceHost` and their RLS/functions — this change adds `Application`
and `Move` on top, following the same conventions (design.md Decisions 2–4 there):
tables read-only to app roles, every write a `SECURITY DEFINER` function with a
fixed empty `search_path`, visibility through RLS `SELECT` policies plus helper
functions in `app_private`.

`co-parent-requests` (openspec/changes/co-parent-requests/, planned separately)
will later change how a child's guardians are looked up. This change is insulated
from that by reading guardians only through the existing
`app_private.my_child_ids()` helper, never a raw join on `guardian`.

## Goals / Non-Goals

**Goals:**
- `Application` and `Move` realising ARCHITECTURE.md exactly: one append-only log,
  status/turn/agreed dates deduced by folding it, never stored.
- The two owner decisions (home capacity, named-host-copy) realised as morphisms
  and rules, not bolted on as UI-only checks.
- Every refusal path enforced in the database, not only the UI (Law 1), matching
  foundation's stance that anyone can call the data service directly.
- The `StayoverEvent` port emitted, typed and stored nowhere — `email-delivery`
  reads it in the same server invocation, never later.

**Non-Goals:**
- `StayDetails`, `CareNote`, `Handover`, `Flight`, `Contact`, templates (change 3).
  `a_details` is created as part of `Application` in the model, but this change
  does not build it; the application table/row is designed so `a_details` can be
  added as a 1:1 owned table later without migrating `application` itself (see
  Decision 2).
- Sending anything (`email-delivery`'s job) — this change only emits the event.
- Changing `co-parent-requests`' subject matter (guardian semantics).

## Model delta (FRAMEWORK §2)

Realised here: `Application` (`a_child`, `a_place`, `a_createdBy`, `a_createdAt`,
`a_moves`, deduced `open?`/`awaiting?`/`agreed?`/`dates`/`status`/`revision`),
`Move` (`mv_kind`, `mv_side`, `mv_by`, `mv_at`, `mv_dates?`, `mv_note?`),
`DateRange` (`dr_start`, `dr_end`); `Place` gains `p_capacity?`; the deduced `side`
morphism becomes total-enough-to-use (was documented but had nothing to apply to
until now). Trns: `validateMove`, `recordMove ⊸`, `foldStatus`, `checkOverlap`,
`deleteApplication ⊸`, plus the capacity check folded into `checkOverlap`'s sibling
(§6.14 below) and `authorize`'s per-application case. Deferred: `applyTemplate ⊸`,
`saveAsTemplate ⊸`, everything under "Stay details and templates" (§4 of
ARCHITECTURE.md).

**§3 Consolidation check.**
- *Move vs a status column plus a counter-offer table* — already resolved in
  ARCHITECTURE.md §2: one append-only log; this change just builds it. A second
  look confirms nothing new appeared during realisation that would split it.
- *Capacity — a new object, or a field on `Place`?* `p_capacity?` has the same
  owner, the same lifecycle and the same visibility as `p_address?` — it is a
  scalar fact about a place, not a span or an entity with its own identity ⟹ one
  nullable column on `place`, not a `Capacity` table.
- *"Nights at a place" — deduced or stored?* Deduced: a pure count over
  `application`/`move` rows filtered to `agreed?` ranges covering a given place and
  night. Storing a running count would be a second source of truth that could drift
  from the move log under concurrent accepts, which is exactly what rule 6's
  exclusion-constraint approach avoids for double-booking; capacity gets the same
  treatment (Decision 4).
- *"Application deleted" snapshot — a stored object?* No: it exists only inside the
  `StayoverEvent` payload at the moment of deletion (ARCHITECTURE.md §8 already
  says so); nothing new is stored for it.

**§4.5 coherence laws this change must keep:**
- **Law 1 (placement honesty)** — `validateMove` runs in the Browser for UX only;
  the authoritative check happens inside `record_move`'s transaction, reading
  `Move*` fresh from `Db`, not from whatever the client sent.
- **Law 2 (well-typed transmissions)** — `t_command` (`MoveCmd`) is parsed at the
  server-action boundary before it reaches the database function; the database
  function re-validates independently (defence in depth, same as foundation).
- **Law 4 (dependency mediation)** — this change emits `t_stayover_event` and
  exposes `participants`/`calendarFacts` as deduced reads; it does not import or
  call anything from `email-delivery`, and nothing here names a mail provider.
- **Law 6 (runsAt is a relation)** — `checkOverlap` (and the capacity check) are
  placed at `AppServer` (early, friendly refusal) and `Db` (authority, via `for
  update`-locked counting, mirroring foundation's last-parent/last-host pattern —
  a `tstzrange` exclusion constraint is *not* used here because capacity requires
  counting *n* overlapping rows, which an exclusion constraint cannot express;
  double-booking, which is a pure `n ≤ 1` case, layers an exclusion constraint on
  top for defence in depth). `authorize`'s per-application case is placed at
  `AppServer` and `Db` (RLS), same as foundation's other objects.

## Decisions

### 1. `application` and `move` tables, one row per move
`application (id, child_id, place_id, created_by, created_at)`.
`move (id, application_id, kind check in ('propose','accept','reject','cancel'),
side check in ('parent','host'), by, at default now(), date_start, date_end,
note)`; `date_start`/`date_end` non-null iff `kind = 'propose'` (a check
constraint), enforcing rule 2 (`mv_dates?` defined ⟺ `PROPOSE`) at the schema
level, not just in the writing function. Moves are insert-only: no `UPDATE`/
`DELETE` grant to any app role, ever (append-only log, rule 5's "never needs
re-syncing" taken literally). *Alternative:* a `status` column on `application`
updated alongside each move — rejected per ARCHITECTURE.md §2, and it would be a
second source of truth the fold in Decision 3 exists to avoid.

### 2. Status, turn and agreed dates are computed, not stored
A `SECURITY DEFINER` function `fold_application(p_application uuid)` (or an
equivalent set-returning query used by every read path) implements the §5 state
table: scans `move` ordered by `at`, tracks the latest open proposal and the
latest agreement, and returns `(status, awaiting, agreed_start, agreed_end,
open_start, open_end, revision)`. Every read (list, detail, capacity/overlap
checks) goes through this one function so the fold is defined once. `a_details`
is deliberately not modelled as a column here — when change 3 adds it, it is a
new 1:1 table keyed on `application.id`, requiring no change to `application` or
this fold. *Alternative:* a materialised/cached status column refreshed by a
trigger — rejected: it reintroduces the sync problem rule 5 avoids, for a fold
cheap enough (a handful of rows per application) not to need caching.

### 3. Move-writing is one function with a kind parameter, not four
`record_move(p_application uuid, p_kind text, p_date_start date default null,
p_date_end date default null, p_note text default null)` resolves the caller's
side via `app_private.my_child_ids()` / `app_private.my_place_ids()` (never a raw
`guardian`/`place_host` join, per the co-parent-requests insulation above), calls
`fold_application` for the current state, checks legality per rule 4 (open
proposal exists and `mv_side ≠ side(caller)` for accept/reject; phase
non-terminal for propose/cancel), checks the date-range shape (rule 2) and, only
for an `accept` that sets or moves `agreed?`, calls the overlap and capacity
checks (Decision 4) before inserting the row — all inside one transaction, so a
concurrent accept cannot slip past either check (same `for update` locking
pattern as foundation's last-parent/last-host). One function (not
`propose_move`/`accept_move`/…) because the legality table, the side resolution
and the transactional guard are identical across kinds; splitting them would
duplicate all of that four ways. *Alternative:* one function per kind — rejected
for the duplication; reconsidered if a kind ever needs materially different
inputs (none do — even `accept`/`reject` take no dates).

### 4. Overlap and capacity are checked together, inside `record_move`
Both are "does accepting these dates break an invariant over agreed stays"
checks, so they run back to back in the same `for update`-locked section:
`checkOverlap` locks and re-derives the child's other agreed ranges (via
`fold_application` over that child's other applications) and refuses on any
overlap (rule 6, half-open ranges: `[start, end)`); the capacity check, only when
`place.capacity` is not null, locks and counts, per night in the proposed range,
how many *other* children already have agreed stays at that place that night, and
refuses if adding this stay would exceed capacity on any night. *Alternative
considered for capacity:* an exclusion constraint on a derived `(place_id,
nightly)` table — rejected as needless extra storage; a room-count problem is a
counting query, not a pairwise-overlap problem, and the fold already has to
re-derive agreed ranges for the overlap check in the same call.
Client-side (`AppServer`) `validateMove` performs the same two checks against the
last-known state for instant UI feedback (Law 6 placement) but the database call
is what actually enforces them.

### 5. Capacity warning is read-only, computed where `PlanAStay` gets its data
The "night is already full" warning shown to a parent proposing dates
(spec scenario) is a *read*, not a write-time refusal — proposals are never
refused for capacity, only accepts are (ARCHITECTURE.md "Enforced when a host
accepts dates"). A function `place_capacity_status(p_place uuid, p_start date,
p_end date)` returns, per night in the range, the current agreed count and
whether it is at or above capacity; the parent-facing form calls it before
submit to decide whether to show the warning banner. This keeps "propose" cheap
and always-available (rule 2/3 unaffected) while still warning honestly.

### 6. Hard delete is one function, `delete_application`
Deletable iff every `move.side` for the application is `'parent'` (rule 13);
checked and executed inside one transaction (`delete from move where
application_id = …; delete from application where id = …`), and the function
returns the snapshot (`c_name`, `p_name`, host member ids, agreed/open dates) the
caller needs to build the `ApplicationDeleted` event, because after the delete
the row is gone. *Alternative:* soft delete (a `deleted_at` column) — rejected:
rule 13 says "removes the application, its moves and its `StayDetails`", i.e.
gone, not hidden; a soft-deleted row would still need a visibility rule to hide
it, adding complexity rule 13 doesn't ask for.

### 7. `StayoverEvent` is a same-invocation return value, not a table
`record_move` and `delete_application` return enough for the calling server
action to build `MoveCommitted` / `ApplicationDeleted` in-process (participants
looked up via the same helpers, since `email-delivery` needs
`participants`/`calendarFacts` which are themselves deduced reads over
`application`/`move`/`guardian`/`place_host`). No `event` table exists — matching
ARCHITECTURE.md §8 ("Stored? No — emitted after commit"). The exact shape (typed
in TypeScript, since it never touches SQL) is:

```ts
type StayoverEvent =
  | { kind: 'MoveCommitted'; application: ApplicationSnapshot; move: MoveRecord; before: Status; after: Status }
  | { kind: 'ApplicationDeleted'; applicationId: string; childName: string; placeName: string; hosts: Participant[]; dates: DateRange | null };
```
`email-delivery`'s design.md owns the exact field list of `ApplicationSnapshot` /
`MoveRecord` / `Status` / `Participant`, since it is the only consumer; this
change guarantees the port exists and fires after commit, not the consumer's
internal shape.

### 8. Visibility extensions layer on top of foundation's RLS, not replace it
`application_select` / `move_select` policies: `child_id in
(select app_private.my_child_ids())` or `place_id in (select
app_private.my_place_ids())` or `app_private.is_admin()` (admin gets `SELECT`
only — no policy ever grants admin `INSERT` on `move`, since there is no
admin-facing write function for it, realising "admin reads everything, takes
part in nothing"). The two visibility *extensions* (host sees a child once
linked; parent sees an address once applied) are realised by widening `child`'s
and `place`'s existing `SELECT` policies with an `exists (select 1 from
application where …)` clause, not by adding new policies — same tables, wider
predicate, per foundation's "home directory vs Place" precedent of narrowing
rather than duplicating.

## Risks / Trade-offs

- [`fold_application` runs on every read] → application-scoped log sizes are tiny
  (a handful of moves per application in this family's v1 scale); no caching
  needed now. If it ever matters, the fix is a materialised view refreshed on
  write, not a schema change.
- [Concurrent accepts on two different applications for the same child/place] →
  both the overlap check and the capacity check take `for update` locks on the
  rows they read before counting, exactly mirroring foundation's last-parent/
  last-host pattern, which is already proven to survive concurrent calls in that
  suite.
- [Capacity counts "other children", not "other applications"] → two applications
  for the *same* child at the same place on the same night would double-count if
  ever both were agreed simultaneously; rule 6 (no double-booking per child)
  already makes that state unreachable, so the capacity count can safely assume
  at most one agreed application per child per place per night.
- [`record_move`'s single-function design means every kind pays the cost of every
  check] → propose/reject/cancel skip the overlap/capacity block entirely (it is
  only entered `if p_kind = 'accept'`), so the cost is paid only where the rule
  applies.

## Migration Plan

Additive only: new `application`/`move` tables and their functions/policies, plus
one new nullable column (`place.capacity`) on an existing table — no data
migration, no existing row touched. `supabase db push` after `db reset` locally;
rollback is dropping the new migration file before any real application data
exists (same posture as foundation's Migration Plan).

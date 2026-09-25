# Design

## Context

Builds on the (implemented, not yet archived) `foundation` change — see
openspec/changes/foundation/design.md and its specs `account-access` and
`children-and-homes` — and on docs/stayover/ARCHITECTURE.md §4 "Accounts,
children and places" (rules 10, 11, 14, 19) and the existing schema in
`supabase/migrations/20260924000100_foundation_schema.sql`,
`..._200_foundation_visibility.sql`, `..._300_foundation_functions.sql`. Those
migrations are applied and are never edited; this change adds a new migration
file only. See proposal.md for motivation; see
specs/co-parent-requests/spec.md for the behaviour contract this design
realises.

Today `guardian (member_id, child_id)` is a plain span: every row means "this
member is an approved parent of this child," created only by `add_child`
(self), `add_guardian` (email, immediate) or `admin_set_guardian` (admin,
immediate). Nothing today represents "asked, not yet answered."

## Goals / Non-Goals

**Goals:**
- Realise the decided behaviour (proposal §"decided with the owner") as a
  minimal extension of the existing `guardian` span, not a parallel structure.
- Keep every current visibility and last-parent guarantee true once pending
  links exist — a pending link must be invisible and must not count.
- Keep `add_guardian` (email co-parent) and `admin_set_guardian` behaviourally
  unchanged from the caller's point of view.

**Non-Goals:**
- Sending the approving parent an email (change 4). This design only names the
  future event.
- Re-pointing applications or templates during merge — neither exists yet
  (change 2/3). The merge function must be written so a later change can
  extend it; this design states that as an invariant, not an implementation.
- A UI for browsing merge candidates or fuzzy/near-duplicate matching. Matching
  is exact after normalisation (case-fold, trim, collapse whitespace) — never
  fuzzy — so the check stays deterministic and cheap.

## Model delta (FRAMEWORK §2)

Realised here: `Guardian` gains three morphisms and one of its existing
morphisms is reinterpreted as a discriminator; two new admin-scoped Trns are
added. Nothing else in the model changes.

| Morphism | Signature | Partiality | Semantics |
| --- | --- | --- | --- |
| `g_status` | `Guardian → {PENDING, APPROVED, DECLINED, WITHDRAWN}` | Total | `APPROVED` for every link created directly (`add_child`, `add_guardian` email, `admin_set_guardian`); `PENDING` for a link opened by duplicate-name detection; moves `PENDING → APPROVED` \| `DECLINED` \| `WITHDRAWN`, and (re-request) `DECLINED`/`WITHDRAWN → PENDING` — never any other transition |
| `g_requestedAt` | `Guardian → Instant` | Total | when the row was created (request or direct link alike) |
| `g_decidedAt?` | `Guardian → Instant` | Partial | defined iff the row was ever a request that got an answer — set on `PENDING → APPROVED\|DECLINED`; null on a direct link and on `WITHDRAWN` |
| `g_decidedBy?` | `Guardian → Member` | Partial | who approved/declined; null on a direct link (there was no decision to make) and on `WITHDRAWN` (the requester decided about themself — `g_member` already says who) |

`g_member`, `g_child` are unchanged (§4 of ARCHITECTURE.md). `side`,
`m_email ∘ …`, `my_child_ids`, `member_select`'s co-guardian clause and every
last-parent check now read `g_status = APPROVED` where they used to read "row
exists" — stated precisely in Decision 2.

**New Trns** (co-parent-requests component; extends the "Owners create, the
admin oversees" family in ARCHITECTURE.md §7):

| Trn | Signature | Notes |
| --- | --- | --- |
| `addChild ⊸` (extended) | `Member × 𝕊 × 𝔹(force) → Child ⊕ Guardian(PENDING)*` | unchanged signature except the new `force` input; on a name match (and `force = false`) it opens/reuses request rows instead of creating a `Child` |
| `approveCoParentRequest ⊸` | `Member × Guardian(PENDING) → Guardian(APPROVED)` | caller must be an `APPROVED` parent of `g_child`, or admin |
| `declineCoParentRequest ⊸` | `Member × Guardian(PENDING) → Guardian(DECLINED)` | same authorization as approve |
| `withdrawCoParentRequest ⊸` | `Member × Guardian(PENDING) → Guardian(WITHDRAWN)` | caller must be `g_member` (the requester), or admin |
| `mergeChild ⊸` | `Member(admin) × Child(source) × Child(target) → Child(target)` | unions `APPROVED` links onto target, cascades away the source's `Guardian` rows (closing any request) by deleting the source `Child` |

No new `Trm`: everything above travels over the existing `t_command`/`t_view`
(Browser↔AppServer) and `t_sql` (AppServer↔Db). One future addition, deferred
to change 4: `t_stayover_event` gains a `CoParentRequested = (child, requester:
Member, approvers: Member*)` case of `StayoverEvent`, emitted on
`PENDING → APPROVED`'s sibling event — the request being *opened*, so Delivery
can mail the approving parent(s). Not built here; recorded so change 4 does
not have to re-derive it.

## §3 Consolidation check — Guardian + status, not a Request table

Candidate: a new `CoParentRequest(requester, child, status, …)` object beside
`Guardian`. Reducing it in the same five steps ARCHITECTURE.md's own
consolidation checks use:

1. **Shape.** A request is exactly the span `(member, child)` plus a status
   and two timestamps — the identical shape `Guardian` already has once it
   gains `g_status`/`g_requestedAt`/`g_decidedAt?`. A second object with the
   same span shape is the textbook case for one object with a discriminator.
2. **Morphisms.** Everything a `CoParentRequest` would need (`who`, `which
   child`, `when asked`, `when/by whom decided`) is already a morphism out of
   `Guardian`'s span, or the three new ones above. A separate object adds no
   morphism `Guardian` could not carry.
3. **Uniqueness.** Both a request and an approved link are naturally keyed by
   `(member, child)` — at most one relationship between a given member and a
   given child at a time. Two tables would need that constraint twice, plus a
   rule forbidding "an `APPROVED` `Guardian` row and a `PENDING` `Request` row
   for the same pair at once" as a runtime check. One table with a status
   enum makes that pair structurally impossible — the same idiom rule 11 uses
   ("no member is both guardian and host... `side` is a function by
   construction") for a different invariant.
4. **Read paths.** Every visibility rule this change must touch —
   `my_child_ids`, `member_select`'s co-guardian join, the last-parent counts
   — already filters or joins on `guardian`. A second table would need each of
   those rules duplicated (union in the request table) instead of one added
   `where g_status = 'approved'`.
5. **Write path.** "Approve" is "move this span from `PENDING` to
   `APPROVED`" — the same state-transition idiom the model already uses for
   `m_status` (rule 17) and `mv_kind`/`status` (§5 of ARCHITECTURE.md). No new
   category of Trn is needed, only new outcomes on the existing
   `linkGuardian`-family Trn (`addChild`/`add_guardian`/`admin_set_guardian`
   realise it; see ARCHITECTURE.md §7).

Conclusion: extend `Guardian`. A separate `Request` object would duplicate the
span, its uniqueness constraint and every read rule that already exists for
`Guardian`, to represent a distinction (pending vs. approved) that a status
column already expresses.

## Decisions

### 1. `g_status` default and transitions are enforced by a check function, not just a CHECK constraint

A plain `check (g_status in (...))` cannot forbid `APPROVED → PENDING` or
`DECLINED → APPROVED` directly (only every write function's own `where
g_status = 'pending'` guard on the row it updates can). Every transition Trn
above updates exactly one row it first re-selects `for update` with an
explicit `and g_status = 'pending'` (or `= 'declined' or = 'withdrawn'` for
the re-request path inside `add_child`), so a stale or wrong-state call is a
no-op/refusal, not a corrupting write — the same locking idiom
`remove_guardian`/`remove_host` already use for their last-parent/last-host
counts. *Alternative:* a Postgres enum with a trigger-enforced state machine —
rejected as more moving parts for the same guarantee a `for update` + `where`
already gives.

### 2. Every existing rule that read `guardian` is re-scoped to `g_status = 'approved'`

Concretely, in the new migration:
- `app_private.my_child_ids()` — add `and status = 'approved'`. Every reader
  built on it (`member_select`'s co-guardian clause, `child_select`,
  `guardian_select`'s "children I parent" branch, `member_emails`) inherits
  the fix for free — this is the payoff of Decision-4 above.
- `remove_guardian`, `admin_set_guardian` (unlink branch) — their existence
  check and their `count(*)` for the last-parent guard both add `and status =
  'approved'`; a pending/declined/withdrawn row must never count towards "this
  child has a parent" and must never be "removed" by these (removing an
  approved link is a different action from declining/withdrawing a request).
- `rename_child`, `add_guardian`, `remove_guardian`'s own "is this caller a
  guardian" check — these currently inline `exists (select 1 from guardian
  where child_id = … and member_id = …)`; each gets `and status = 'approved'`
  added (or is rewritten to `p_child in (select app_private.my_child_ids())`,
  equivalent after Decision 2's first bullet).
- `guardian_select` policy gains one more `or member_id =
  app_private.my_member_id()` branch, unfiltered by status, so the requester
  can read their own request row in every state (needed for "asked to
  confirm"/"declined" UI) — while `child_select` stays approved-only, so the
  requester still cannot read the matched `Child` row itself (the app already
  knows the name it echoes back; see spec scenario "Requester cannot see the
  matched child while pending").
- `add_guardian` (email path) and `admin_set_guardian` (link branch) change
  their `insert … on conflict (member_id, child_id) do nothing` to `do update
  set status = 'approved', decided_at = null, decided_by = null` — so if a
  stray pending/declined/withdrawn row already exists for that exact
  (member, child) pair (a request that predates an email-add, or vice versa),
  the direct path still lands on `APPROVED` instead of silently no-op'ing
  against a non-approved row. This is an internal correctness fix, not a
  behaviour change — the caller-visible outcome ("that account is now a
  parent") is identical either way, which is why proposal.md lists the email
  path as unaffected.

### 3. Duplicate matching lives inside `add_child`, not a separate lookup Trn

`add_child(p_name, p_force default false)` keeps its existing signature plus
one optional argument. When `p_force` is false, it normalises the name
(`lower(btrim(regexp_replace(p_name, '\s+', ' ', 'g')))`) and looks for
children whose same-normalised name has no `APPROVED` guardian row for the
caller. *Why one function, not `find_duplicate_child` + `add_child`:* two
round trips would let the set of children change between the check and the
insert (another parent adds the same name in between); one function checks and
acts inside the same transaction, the same reasoning `design.md` (foundation)
already gives for `checkOverlap`/atomic writes. Matching is case/whitespace
normalised only — no fuzzy matching, so it stays a deterministic, indexable
equality check (a functional index on the normalised name is added for this
lookup; still fast at family scale even without one).

For each match, `add_child` upserts a `guardian` row `(caller, matched_child)`:
absent → insert `PENDING`; existing `DECLINED`/`WITHDRAWN` → update back to
`PENDING` (re-request, `decided_at`/`decided_by` cleared) — this is also how
"no duplicate pending request" (spec) holds: an existing `PENDING` row is
simply left alone, never duplicated, because the upsert's `where` only fires
on the non-pending states. `APPROVED` never appears here because the matching
query already excludes children the caller approvingly parents.

Return shape: `(outcome ∈ {'created','requested'}, child_id?, request_ids
uuid[])` — `child_id` set iff `outcome = 'created'` (new child or
`p_force = true`); `request_ids` set iff `'requested'`. Nothing in the return
identifies the matched child's other parents; the app already has the name
the person typed and needs nothing else to show the message in the spec.

### 4. Merge deletes the source child; it does not soft-delete

`mergeChild(p_source, p_target)` (admin only): refuses if `p_source = p_target`
or either id does not exist; otherwise, inside one transaction, unions every
`APPROVED` `guardian` row of the source onto the target with the same
upsert-to-approved as Decision 2's last bullet, then deletes the source
`Child` row. `guardian.child_id` already has `on delete cascade` (schema
migration 100), so every remaining row referencing the source — including any
`PENDING`/`DECLINED`/`WITHDRAWN` request — is removed by the database in the
same statement; that satisfies "pending requests against the source are
closed" without a separate update pass, and leaves nothing that could later be
approved against a child that no longer exists. *Invariant for later
changes:* once `Application`/`StayDetails`/templates exist (change 2/3) and
reference `Child`, `mergeChild` must re-point those rows onto the target
**before** deleting the source (they must not be silently deleted); this
design intentionally does not implement that re-pointing because nothing to
re-point exists yet, but a later change extending `mergeChild` must add it in
the same transaction, not as a follow-up cleanup step, or a merge could leave
an application referencing a child that no longer exists.

*Rejected alternative:* soft-delete (`child.merged_into?`) — this would need
every future read of `child` to filter it out forever, i.e. permanent debt on
every reader, for a case (undoing a merge) the admin can already handle by
re-adding the child if it is ever wrong; hard delete is chosen deliberately,
matching the project's existing "hard delete only while unanswered" pattern
(ARCHITECTURE.md rule 13) for the same reason — bounded blast radius, no
permanent filter everywhere else.

### 5. UI: pending state surfaces on `ParentHome`, action surfaces on `Admin`

`ParentHome` (docs/stayover/general/ui-design-brief.md) gains: the requester's
own pending/declined requests (as a banner near "Add your child" — "Lyanne may
already be on the app — we've asked their parent to confirm you as
co-parent," with "add anyway"; and, once declined, "That wasn't approved —
add Lyanne as a new child?"), and, for existing parents, a pending-request
alert per child ("Dad2 (dad2@example.com) asked to be Lyanne's co-parent —
Approve / Decline"). No new screen: both states are additions to the existing
`ParentHomeProps` contract, following the file's own "presentational only,
typed props, callback actions return `ActionResult`" convention. `Admin`
gains a "Merge children" control (pick source, pick target, confirm) beside
the existing Children card, following the same `ConfirmDialog` pattern
already used for deactivation.

## Risks / Trade-offs

- [A parent registers many near-miss spellings to avoid ever matching] →
  accepted; exact-after-normalisation matching is a v1 deliberate choice
  (Non-Goals), and the admin's merge is the backstop when it does not
  detect a real duplicate.
- [Two parents both call `add_child` for the same new name at the same
  instant] → both find no match (the other's row is not yet committed) and
  both create a `Child`; this is the existing gap the admin's merge exists
  to fix, not a regression this change introduces (foundation had no
  detection at all).
- [Re-scoping `my_child_ids()` to `approved` touches every reader built on it]
  → exactly the payoff of building on one helper instead of duplicating the
  filter; the test suite re-runs every foundation refusal/visibility test
  from `openspec/changes/foundation` unchanged (they all only ever created
  `APPROVED` rows) plus the new ones, so a regression there fails loudly.
- [`add_guardian`/`admin_set_guardian`'s upsert-to-approved could silently
  "approve" a request the target member never asked for] → intended: if a
  child's existing parent adds someone by email, that is itself full,
  immediate consent from an approved parent — identical in authority to
  approving a pending request from the same person, just via the other entry
  point.

## Migration Plan

New file only (`supabase/migrations/<timestamp>_co_parent_requests.sql`),
after `..._500_set_join_code_where.sql`; foundation's five migrations are
never edited. Contains: `alter table guardian add column …` (the three new
columns, defaulted so existing rows read as `APPROVED`/`requested_at =
created row's insertion time` is not recoverable for pre-existing rows — they
default `g_requestedAt = now()` at migration time, which is acceptable since
no such rows exist yet, this is greenfield with foundation not yet
archived/deployed with real data); the functional index for normalised
`child.name`; `create or replace function app_private.my_child_ids()`
(approved-only); the `guardian_select` policy dropped and recreated with the
extra branch; `create or replace function public.add_child`,
`public.add_guardian`, `public.admin_set_guardian`, `public.rename_child`,
`public.remove_guardian` with the approved-only checks; new functions
`approve_co_parent_request`, `decline_co_parent_request`,
`withdraw_co_parent_request`, `merge_child`. Rollback: this is greenfield
(no production data), so rollback is `supabase db reset` locally / redeploy
the previous migration set to the hosted project before any real family data
exists in it — same posture as foundation's own migration plan.

## Open Questions

None — every decision above was necessary to satisfy the "decided with the
owner" list and the §3/§4.5 rules; nothing here changes the specs, the
approach, or the task breakdown if revisited later.

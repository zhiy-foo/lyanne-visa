# Proposal

## Why

Two parents who each register independently and separately add a child with the
same name end up with two `Child` rows for the same real child, splitting their
applications, templates and history. Foundation's co-parent path (`add_guardian`)
only helps once one parent already knows the other is on the app; it does nothing
at the point where the second parent adds the child. This change closes that gap
at the one place it can be caught cheaply — the moment a same-name child is added —
without ever telling the requester who the existing parents are.

## What Changes

- **Duplicate check on add child.** When an active parent adds a child whose name
  matches (case-insensitive, trimmed, whitespace-collapsed) a child they are not
  already a parent of, no new child is created. Instead a co-parent request is
  opened against each matching child, and the requester is told a child that name
  may already be on the app and its parent has been asked to confirm — with an
  explicit "add anyway" action that creates the new child regardless.
- **Approval by the existing parent(s).** Every approved parent of the matched
  child sees a pending request on their home page, naming the requester (name and
  email), and can approve (the requester becomes a parent of that child) or
  decline (the request closes; the requester is told and may add anyway). The
  requester may withdraw a pending request. A second request from the same
  requester for the same child while one is already pending is not created.
- **Admin merge.** The admin can merge two child records — source into target —
  unioning parent links onto the target, closing the source's pending requests,
  and removing the source child. The target's main parent stays main; the
  source's parents (including its own main parent) join the target as
  co-parents.
- **The existing email co-parent path is unchanged** in outcome, but who may
  use it narrows — see "Main parent" below.
- **Main parent (decided with the owner, 2026-09-24).** Every child has exactly
  one main parent, who always holds an approved parent link for that child.
  A new child's creator is its main parent; existing children are backfilled
  with their creator as main parent.
  - The main parent adds co-parents by email, removes co-parents, approves or
    declines co-parent requests, and can hand the main-parent role over to
    another approved co-parent.
  - A co-parent can do everything else a parent does (including renaming the
    child) but may remove only themselves (leave), cannot add or remove other
    parents, and does not see or act on pending co-parent requests.
  - The main parent cannot remove themselves or leave while main — they must
    hand over first. Every child keeps at least one parent throughout
    (existing rule 14).
  - The admin can reassign the main parent to any of the child's approved
    parents, remove any non-main parent, and approve or decline co-parent
    requests — a backstop for when the main parent's account is deactivated.
  - A declined co-parent request may be re-requested by the same requester
    only once the main parent's decline is at least 24 hours old; a withdrawn
    request may be re-requested immediately.

Out of scope: the email that notifies an approving parent (change 4 delivery;
this change only defines the future `StayoverEvent` case for it); re-pointing
applications/templates during merge (no such data exists yet — change 2/3
introduce it and must extend the merge function to carry it over).

## Capabilities

### New Capabilities

- `co-parent-requests`: the duplicate-name detection on add-child, the pending
  co-parent request and its approve/decline/withdraw/add-anyway lifecycle, the
  visibility rule that a pending request grants no access, the admin's child
  merge, and the main-parent role (one per child, its narrower approve/manage
  permissions, hand-over, admin reassignment, and the re-request cooldown).

### Modified Capabilities

None. This change adds a new lifecycle around the existing `children-and-homes`
add-child and co-parent behaviour (from the unarchived `foundation` change) rather
than editing its not-yet-archived spec; see design.md for how the two relate.

## Impact

- **New code**: a migration under `supabase/migrations/` (new file; foundation's
  are already applied and are never edited) adding `child.main_parent_id` and
  `guardian`'s status columns, `hand_over_main_parent` and admin's
  `set_main_parent` functions alongside the co-parent-request lifecycle
  functions; new server actions and error-map entries in `src/stayover/`; new
  `ParentHome` states for pending/asked-to-confirm requests, the main-parent
  badge, "Leave" vs "Remove", and "Make main parent"; an admin merge control
  and a main-parent reassign control in `src/ui/screens/Admin.tsx`.
- **Changed code**: `add_child` gains the duplicate check and sets the new
  child's creator as its main parent; `add_guardian`'s and `remove_guardian`'s
  authorization checks change from "any approved parent" to the main-parent/
  co-parent split above; `ParentHome`'s and `Admin`'s prop contracts in
  `docs/stayover/general/ui-design-brief.md` gain the new fields and
  callbacks; `member_emails`, `my_child_ids` and the `member_select`
  co-guardian clause keep their existing signatures but must be re-verified to
  count only approved guardian links (they already do — see design.md).
- **Docs**: `docs/stayover/ARCHITECTURE.md` (rules 10, 14, the morphism table
  gaining `c_mainParent`), `IMPLEMENTATION.md` and `STATUS.md` reconciled once
  implemented.

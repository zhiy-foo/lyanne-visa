# Tasks

## 1. Migration

- [ ] 1.1 Add a new migration file
      `supabase/migrations/<timestamp>_co_parent_requests.sql` (after
      `20260924000500_set_join_code_where.sql`; never edit the applied
      foundation migrations) adding `guardian.status` (default `'approved'`,
      check `in ('pending','approved','declined','withdrawn')`),
      `guardian.requested_at` (default `now()`), `guardian.decided_at`
      (nullable), `guardian.decided_by` (nullable, fk `member(id)`), and a
      functional index on `lower(btrim(regexp_replace(child.name, '\s+', '
      ', 'g')))` for duplicate lookup — verify with `supabase db reset`
      (local) applying cleanly and `\d guardian` / `\d child` showing the new
      columns and index.
- [ ] 1.2 In the same migration, `create or replace` `app_private.my_child_ids()`
      to add `and status = 'approved'` — verify with a PGlite test: a member
      with only a `pending` guardian row gets zero rows from
      `my_child_ids()`.
- [ ] 1.3 Drop and recreate the `guardian_select` RLS policy to add `or
      member_id = app_private.my_member_id()` (unfiltered by status) —
      verify with a PGlite test: a requester can `select` their own
      `pending`/`declined`/`withdrawn` row directly; a third party cannot.
- [ ] 1.4 `create or replace` `remove_guardian` and `admin_set_guardian`
      (unlink branch) so both the existence check and the last-parent
      `count(*)` add `and status = 'approved'` — verify with a PGlite test:
      a `pending` row for a child does not block removing that child's sole
      `approved` guardian's own error path from firing correctly (the count
      still treats the child as having exactly one parent), and does not let
      `remove_guardian` delete a `pending` row.
- [ ] 1.5 `create or replace` `rename_child` and `add_guardian`'s
      authorization check to require an `approved` link (via `p_child in
      (select app_private.my_child_ids())` or an added `and status =
      'approved'`) — verify with a PGlite test: a member with only a
      `pending` request for a child cannot rename it or add a co-parent to
      it.
- [ ] 1.6 `create or replace` `add_guardian` and `admin_set_guardian` (link
      branch) so their insert upserts `on conflict (member_id, child_id) do
      update set status = 'approved', decided_at = null, decided_by = null`
      instead of `do nothing` — verify with a PGlite test: adding a
      co-parent by email when a `declined`/`withdrawn` row already exists for
      that exact pair lands the member as an `approved` parent.

## 2. Request lifecycle functions

- [ ] 2.1 `create or replace function public.add_child(p_name text, p_force
      boolean default false)`: when not forced, normalise the name and match
      against children the caller has no `approved` link to; on a match,
      upsert `guardian(caller, matched_child)` to `pending` (re-request from
      `declined`/`withdrawn`, no-op if already `pending`) per Decision 3, and
      return `outcome = 'requested'` with the request ids; otherwise (no
      match, or `p_force = true`) create the child as today and return
      `outcome = 'created'` — verify with PGlite tests for: no match creates
      a child (existing foundation scenario still passes unchanged); one
      match opens exactly one pending request and creates no child; two
      matches (two separately-added same-named children, e.g. after a prior
      unresolved duplicate) open one pending request per match; a match
      against a child the caller already approvingly parents is excluded
      (spec scenario); calling again while `pending` creates no second
      request (`count(*)` from `guardian` for that pair stays 1);
      `p_force = true` always creates a new child regardless of matches.
- [ ] 2.2 Add `public.approve_co_parent_request(p_child uuid, p_member uuid)`:
      caller must be an `approved` parent of `p_child` or admin; row must be
      `pending`; sets `status = 'approved'`, `decided_at = now()`,
      `decided_by = caller` — verify with PGlite tests: an approved parent
      succeeds and the requester's `my_child_ids()` now includes the child;
      a non-parent, non-admin caller is refused and the row stays `pending`;
      approving an already-`approved`/`declined`/`withdrawn` row is refused.
- [ ] 2.3 Add `public.decline_co_parent_request(p_child uuid, p_member uuid)`:
      same authorization as 2.2; sets `status = 'declined'`, `decided_at =
      now()`, `decided_by = caller` — verify with a PGlite test: the
      requester's own `select` on the row (task 1.3) shows `declined`, and
      the requester's `my_child_ids()` still excludes the child.
- [ ] 2.4 Add `public.withdraw_co_parent_request(p_child uuid)`: caller must
      be the requester (`g_member = my_member_id()`) or admin; row must be
      `pending`; sets `status = 'withdrawn'` — verify with PGlite tests: the
      requester succeeds; a different member (including an approved parent
      of the matched child, who is not the requester) is refused; the
      matched child's parents no longer see it as `pending` (their
      `pending`-filtered read returns nothing for it).
- [ ] 2.5 Add `public.merge_child(p_source uuid, p_target uuid)`: admin only;
      refuses `p_source = p_target` or either id missing; unions `approved`
      guardian rows from source onto target with the same upsert-to-approved
      as task 1.6; deletes the source `child` row (cascade removes its
      remaining `guardian` rows) — verify with PGlite tests: parents of
      both source and target all end up `approved` parents of the target;
      the source child no longer exists (`select` returns nothing to
      anyone, including admin); a `pending` request against the source is
      gone after merge and cannot later be approved (function call on the
      now-missing child errors `not_found`); merge into itself is refused
      and nothing changes; a non-admin caller (including a parent of either
      child) is refused and neither child changes.

## 3. Server actions and error mapping

- [ ] 3.1 Add server actions in `src/stayover/` wrapping `add_child` (with
      the `force` flag), `approve_co_parent_request`,
      `decline_co_parent_request`, `withdraw_co_parent_request` and
      `merge_child`, following the existing action shape used for
      `add_guardian`/`remove_guardian` — verify by exercising each through a
      unit/integration test that asserts the RPC name and args sent match
      the migration's function signature.
- [ ] 3.2 Add the new refusal codes (`invalid_request_state` or reuse
      `not_found`/`not_guardian_of_child`/`not_admin` as raised by the
      functions in section 2 — confirm exact codes once 2.2-2.5 are written)
      to `src/stayover/errors.ts`'s `MESSAGES` map with spec-worded copy —
      verify with `src/stayover/errors.test.ts` cases for every new code,
      plus a case proving an unmapped code still falls back to the generic
      message (existing test pattern).

## 4. UI

- [ ] 4.1 Extend `ParentHomeProps` (and `ParentHome.tsx`) with the
      requester's own pending/declined requests and, per child, any pending
      incoming requests with approve/decline actions, per design.md
      Decision 5 — verify with a component test for each new state: pending
      "may already be on the app" banner with working "add anyway"; declined
      state with working "add as new"; incoming pending request banner on a
      parent's own child with working Approve/Decline, each showing a
      busy state and surfacing `result.message` on refusal (existing
      `ChildCard`/`onAddChild` pattern).
- [ ] 4.2 Add a "Merge children" control to `Admin.tsx` (pick source, pick
      target, `ConfirmDialog`, calls `merge_child`) — verify with a
      component test: confirming calls the merge callback with the chosen
      ids; a refusal (e.g. same child picked twice) is prevented client-side
      and/or surfaces `result.message`.
- [ ] 4.3 Update the prop contracts and states in
      `docs/stayover/general/ui-design-brief.md` for `ParentHomeProps` and
      `AdminProps` to match 4.1/4.2 — verify by re-reading the file: every
      new callback/field used by the components in 4.1/4.2 is documented
      there and nothing is renamed or removed from the existing contract.

## 5. Docs reconciliation and drift check

- [ ] 5.1 Update `docs/stayover/ARCHITECTURE.md`: `Guardian`'s row in §4's
      morphism table gains `g_status`/`g_requestedAt`/`g_decidedAt?`/
      `g_decidedBy?`; rule 10 gains the duplicate-request behaviour; rule 14
      gets a note that only `APPROVED` links count — verify by re-reading
      the affected rules against specs/co-parent-requests/spec.md for
      wording consistency.
- [ ] 5.2 Update `docs/stayover/IMPLEMENTATION.md`: add rows for the new
      `Guardian` columns and the five new/changed functions from sections 1
      and 2 with their `file:symbol` (the migration file and function name)
      and `state = built` once merged — verify every row's file:symbol
      resolves to a real function/column in the migration file.
- [ ] 5.3 Update `docs/stayover/STATUS.md`'s completeness table and headline
      to reflect the new morphisms/rules as built — verify the headline's
      rule count and the table match IMPLEMENTATION.md's state column.
- [ ] 5.4 Run the project's drift check (`/supercharge` end-of-session
      reconciliation) comparing ARCHITECTURE.md/IMPLEMENTATION.md/STATUS.md
      against the code added in sections 1-4 — verify it reports no dead or
      missing rows for anything touched by this change.

## 6. Full-suite verification

- [ ] 6.1 Run the full PGlite/Vitest test suite (`npm test` or the project's
      equivalent) and confirm every foundation test (account-access,
      children-and-homes) still passes unchanged alongside every new test
      from sections 1-2 — verify by a clean run with zero failures.
- [ ] 6.2 `openspec validate co-parent-requests --strict` passes before this
      change is considered ready to apply.

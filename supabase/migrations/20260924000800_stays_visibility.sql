-- Stays visibility: RLS SELECT policies for `application`/`move`, plus the
-- two visibility extensions (design.md Decision 8; ARCHITECTURE.md rule 12
-- and "Hosts see children and parents see addresses through applications").
-- Mirrors 20260924000200_foundation_visibility.sql's conventions: tables
-- read-only to app roles (SELECT only, filtered by RLS); every write goes
-- through a SECURITY DEFINER function in the next migration.

-- New tables created since 20260924000200_foundation_visibility.sql ran are
-- already locked down by its `alter default privileges ... revoke all on
-- tables from anon, authenticated;` — `application` and `move` start with no
-- grants to anon/authenticated. The explicit grant below is the same
-- belt-and-braces documentation foundation's migration used for its own
-- tables, not a required unlock.

grant select on application, move to authenticated;

-- Ids of the applications the caller may see: guardian of the child, host of
-- the place. A dedicated helper (not inlined into application_select/
-- move_select) so move_select's policy does not need to reference
-- application's own RLS-filtered rows directly.
create function app_private.my_application_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select id from public.application
  where child_id in (select app_private.my_child_ids())
     or place_id in (select app_private.my_place_ids());
$$;

revoke execute on function app_private.my_application_ids() from public;
grant execute on function app_private.my_application_ids() to authenticated;

-- application: guardian of the child, host of the place, or admin (rule 12).
create policy application_select on application
  for select to authenticated
  using (
    id in (select app_private.my_application_ids())
    or app_private.is_admin()
  );

-- move: same visibility as its application (rule 12 — "a member reads an
-- application ... and its moves").
create policy move_select on move
  for select to authenticated
  using (
    application_id in (select app_private.my_application_ids())
    or app_private.is_admin()
  );

-- Visibility extensions (rule 12's safeguard clause + the dedicated
-- "Hosts see children and parents see addresses through applications"
-- requirement): widen `child`'s and `place`'s existing SELECT policies with
-- an `exists ... application` clause rather than adding new policies, per
-- design.md Decision 8 and foundation's narrow-rather-than-duplicate
-- precedent.

-- child: guardians of the child (existing), now also any host of a place
-- the child has an application at (name only — `child` carries no other
-- sensitive field), or admin.
alter policy child_select on child
  using (
    id in (select app_private.my_child_ids())
    or id in (
      select a.child_id from public.application a
      where a.place_id in (select app_private.my_place_ids())
    )
    or app_private.is_admin()
  );

-- place: hosts of the place (existing, full row incl. address), now also
-- any parent who has applied there (full row, including address — rule 12's
-- "parents with an application at that place" get the address too), or
-- admin.
alter policy place_select on place
  using (
    id in (select app_private.my_place_ids())
    or id in (
      select a.place_id from public.application a
      where a.child_id in (select app_private.my_child_ids())
    )
    or app_private.is_admin()
  );

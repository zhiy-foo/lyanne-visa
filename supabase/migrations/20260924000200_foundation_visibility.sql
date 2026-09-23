-- Foundation visibility: read-only grants, RLS SELECT policies and the
-- address-free home directory (design.md Decision 3, 4; ARCHITECTURE.md §4.5
-- Law 1, rules 11, 12, 14-21).
--
-- Tables are read-only to app roles: `authenticated` gets SELECT (filtered by
-- RLS) and no INSERT/UPDATE/DELETE. Every write goes through a
-- SECURITY DEFINER function (a later change) that resolves the caller,
-- checks role/link/admin/active status, and writes atomically.

-- Lock down the permissive defaults from the (test) shim / real Supabase's
-- own defaults, so nothing is reachable by accident. -----------------------

revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;

-- Read-only grants: only the five family tables, only to authenticated.
-- Nothing to anon; nothing on app_admin / app_setting / join_attempt to
-- either role (deployment configuration, not family data).

grant select on member, child, place, guardian, place_host to authenticated;

-- Private helper schema, not exposed by the Supabase API. ------------------

create schema app_private;

grant usage on schema app_private to authenticated;

-- The caller's own active member id, or null (waiting/deactivated/no
-- account get no rows from any policy that composes on this).
create function app_private.my_member_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select id from public.member
  where user_id = auth.uid() and status = 'active';
$$;

-- True iff the caller's auth.users email, lower-cased, is on the admin list.
create function app_private.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    join public.app_admin a on a.email = lower(u.email)
    where u.id = auth.uid()
  );
$$;

-- Ids of the children the caller is a guardian of. A dedicated helper (not
-- inlined into policies on `guardian` itself) so RLS on guardian/place_host
-- does not recurse into itself.
create function app_private.my_child_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select child_id from public.guardian
  where member_id = app_private.my_member_id();
$$;

-- Ids of the places the caller hosts at.
create function app_private.my_place_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select place_id from public.place_host
  where member_id = app_private.my_member_id();
$$;

-- Postgres grants EXECUTE on every new function to PUBLIC unless told
-- otherwise; the ALTER DEFAULT PRIVILEGES REVOKE above states the intent for
-- future functions, but each function's own ACL is what Postgres actually
-- checks, so revoke PUBLIC explicitly on each one before granting to
-- authenticated only.
revoke execute on function app_private.my_member_id() from public;
revoke execute on function app_private.is_admin() from public;
revoke execute on function app_private.my_child_ids() from public;
revoke execute on function app_private.my_place_ids() from public;

grant execute on function app_private.my_member_id() to authenticated;
grant execute on function app_private.is_admin() to authenticated;
grant execute on function app_private.my_child_ids() to authenticated;
grant execute on function app_private.my_place_ids() to authenticated;

-- RLS SELECT policies --------------------------------------------------------

-- member: self, co-guardians of my children, co-hosts of my places, admin.
create policy member_select on member
  for select to authenticated
  using (
    id = app_private.my_member_id()
    or id in (
      select guardian.member_id from guardian
      where guardian.child_id in (select app_private.my_child_ids())
    )
    or id in (
      select place_host.member_id from place_host
      where place_host.place_id in (select app_private.my_place_ids())
    )
    or app_private.is_admin()
  );

-- child: children I am a guardian of, or admin.
create policy child_select on child
  for select to authenticated
  using (
    id in (select app_private.my_child_ids())
    or app_private.is_admin()
  );

-- guardian: links for children I am a guardian of, or admin.
create policy guardian_select on guardian
  for select to authenticated
  using (
    child_id in (select app_private.my_child_ids())
    or app_private.is_admin()
  );

-- place: places I host, or admin.
create policy place_select on place
  for select to authenticated
  using (
    id in (select app_private.my_place_ids())
    or app_private.is_admin()
  );

-- place_host: links for places I host, or admin.
create policy place_host_select on place_host
  for select to authenticated
  using (
    place_id in (select app_private.my_place_ids())
    or app_private.is_admin()
  );

-- Home directory: every active member (and the admin) sees each place's name
-- and time zone, never the address (rule 12). Implemented as a
-- SECURITY DEFINER function rather than the view named in design.md Decision
-- 4 — a `security_invoker = false` view over `place` filtered by a function
-- call trips Supabase's security-definer-view linter warning even though the
-- function itself is intentionally definer; a function avoids that false
-- positive while giving the identical read (id, name, time_zone; no
-- address). Waiting/deactivated callers get no rows because
-- my_member_id() is null for them and they are not admins.

create function public.home_directory()
returns table (id uuid, name text, time_zone text)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.name, p.time_zone
  from public.place p
  where app_private.my_member_id() is not null or app_private.is_admin();
$$;

revoke execute on function public.home_directory() from public;
grant execute on function public.home_directory() to authenticated;

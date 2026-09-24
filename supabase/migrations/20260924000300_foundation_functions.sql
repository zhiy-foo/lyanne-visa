-- Foundation functions: reads that RLS hides from callers themselves, plus
-- every write (design.md Decision 3, 6; ARCHITECTURE.md §4 rules 1, 10, 11,
-- 14-21). Tables stay read-only to app roles; every write goes through a
-- SECURITY DEFINER function here that resolves the caller from auth.uid(),
-- checks role/link/admin/active status, and writes atomically.
--
-- Conventions used throughout this file:
--   * schema public (so Supabase's PostgREST exposes it as an RPC);
--   * `security definer set search_path = ''`, every name schema-qualified;
--   * caller resolved from auth.uid() inside the function body (Law 1 —
--     never trust an id from the browser);
--   * refusals raise `errcode = 'P0001'` with the closed-list code as the
--     exception message, and a human hint for logs/debugging; the app maps
--     the code to its own message;
--   * every function: `revoke execute ... from public, anon;` then
--     `grant execute ... to authenticated;` — the internal checks are the
--     real guard, the grant is belt-and-braces (and doubly so now that
--     migration 200 already revokes execute from anon/public by default).

-- Small helper: is a time zone name valid? Tries the authoritative catalog
-- view first (present on real Postgres/Supabase and PGlite); falls back to
-- probing with `now() at time zone` if that view is ever unavailable.
create function app_private.is_valid_time_zone(p_tz text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_valid boolean;
begin
  if p_tz is null or btrim(p_tz) = '' then
    return false;
  end if;

  begin
    select exists (
      select 1 from pg_catalog.pg_timezone_names where name = p_tz
    ) into v_valid;
    return v_valid;
  exception when others then
    begin
      perform now() at time zone p_tz;
      return true;
    exception when others then
      return false;
    end;
  end;
end;
$$;

revoke execute on function app_private.is_valid_time_zone(text) from public;

-- Admin-only member status transition, shared by approve/decline/deactivate/
-- reactivate_member below. Locks the row (`for update`) so the check and the
-- write are atomic.
create function app_private.transition_member_status(p_member uuid, p_from text, p_to text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current text;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = 'P0001', hint = 'You must be signed in.';
  end if;
  if not app_private.is_admin() then
    raise exception 'not_admin' using errcode = 'P0001', hint = 'Only the admin can change account status.';
  end if;

  select status into v_current from public.member where id = p_member for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001', hint = 'No such account.';
  end if;

  if v_current <> p_from then
    raise exception 'invalid_status_transition' using errcode = 'P0001',
      hint = 'That account cannot change from its current status this way.';
  end if;

  update public.member set status = p_to, status_at = now() where id = p_member;
end;
$$;

revoke execute on function app_private.transition_member_status(uuid, text, text) from public;

-- Reads -----------------------------------------------------------------
-- RLS hides waiting/deactivated/unregistered/admin callers from every
-- policy that composes on my_member_id(); these functions give a signed-in
-- caller a way to read their own status, and give the app the emails RLS
-- alone cannot express (there is no email column on `member`).

-- Always exactly one row for a signed-in caller; member fields are null when
-- the caller has not registered.
create function public.my_account()
returns table (
  member_id uuid,
  name text,
  role text,
  status text,
  email text,
  is_admin boolean,
  code_attempts_left int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = 'P0001', hint = 'You must be signed in.';
  end if;

  return query
  select
    m.id,
    m.name,
    m.role,
    m.status,
    (select lower(u.email) from auth.users u where u.id = v_uid),
    app_private.is_admin(),
    greatest(0, 5 - coalesce(ja.wrong_count, 0))
  from (select 1) as one_row
  left join public.member m on m.user_id = v_uid
  left join public.join_attempt ja on ja.user_id = v_uid;
end;
$$;

revoke execute on function public.my_account() from public, anon;
grant execute on function public.my_account() to authenticated;

-- Emails of the members the caller may see under member_select's own rule
-- (self, co-guardians, co-hosts; every member if admin); nothing for a
-- caller who is not an active member and not admin.
create function public.member_emails()
returns table (member_id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, (select lower(u.email) from auth.users u where u.id = m.user_id)
  from public.member m
  where
    m.id = app_private.my_member_id()
    or m.id in (
      select g.member_id from public.guardian g
      where g.child_id in (select app_private.my_child_ids())
    )
    or m.id in (
      select ph.member_id from public.place_host ph
      where ph.place_id in (select app_private.my_place_ids())
    )
    or app_private.is_admin();
$$;

revoke execute on function public.member_emails() from public, anon;
grant execute on function public.member_emails() to authenticated;

-- Admin-only: every account with its links, for the admin page.
create function public.admin_accounts()
returns table (
  member_id uuid,
  name text,
  email text,
  role text,
  status text,
  status_at timestamptz,
  created_at timestamptz,
  child_ids uuid[],
  place_ids uuid[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = 'P0001', hint = 'You must be signed in.';
  end if;
  if not app_private.is_admin() then
    raise exception 'not_admin' using errcode = 'P0001', hint = 'Only the admin can view all accounts.';
  end if;

  return query
  select
    m.id,
    m.name,
    (select lower(u.email) from auth.users u where u.id = m.user_id),
    m.role,
    m.status,
    m.status_at,
    m.created_at,
    coalesce((select array_agg(g.child_id) from public.guardian g where g.member_id = m.id), '{}'),
    coalesce((select array_agg(ph.place_id) from public.place_host ph where ph.member_id = m.id), '{}')
  from public.member m
  order by m.created_at;
end;
$$;

revoke execute on function public.admin_accounts() from public, anon;
grant execute on function public.admin_accounts() to authenticated;

-- Registration and join code (rules 1, 15, 16, 21; design Decision 6) ----

-- TRAP handled deliberately: a wrong code must not raise, because a raised
-- exception rolls back everything the function did, including the attempt
-- counter increment. Instead it upserts join_attempt and returns
-- outcome = 'wrong_code' with no member created.
create function public.register(p_role text, p_name text, p_code text default null)
returns table (outcome text, member_id uuid, attempts_left int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_wrong_count int;
  v_hash text;
  v_trimmed_code text;
  v_member_id uuid;
  v_status text;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = 'P0001', hint = 'You must be signed in.';
  end if;

  if app_private.is_admin() then
    raise exception 'admin_cannot_register' using errcode = 'P0001',
      hint = 'The admin account cannot register as a parent or host.';
  end if;

  if exists (select 1 from public.member where user_id = v_uid) then
    raise exception 'already_registered' using errcode = 'P0001',
      hint = 'This identity already has an account.';
  end if;

  if p_role is null or p_role not in ('parent', 'host') then
    raise exception 'invalid_role' using errcode = 'P0001', hint = 'Choose parent or host.';
  end if;

  v_name := btrim(coalesce(p_name, ''));
  if length(v_name) < 1 or length(v_name) > 80 then
    raise exception 'invalid_name' using errcode = 'P0001', hint = 'Enter a name between 1 and 80 characters.';
  end if;

  select coalesce(wrong_count, 0) into v_wrong_count
  from public.join_attempt where user_id = v_uid;
  v_wrong_count := coalesce(v_wrong_count, 0);

  v_trimmed_code := nullif(btrim(coalesce(p_code, '')), '');

  select join_code_hash into v_hash from public.app_setting;

  if v_wrong_count >= 5 or v_trimmed_code is null or v_hash is null then
    -- Attempts exhausted, no/blank code, or no code set at all — the code
    -- (if any) is not checked; the account waits.
    v_status := 'waiting';
  elsif extensions.crypt(v_trimmed_code, v_hash) = v_hash then
    v_status := 'active';
  else
    insert into public.join_attempt (user_id, wrong_count)
    values (v_uid, 1)
    on conflict (user_id) do update set wrong_count = public.join_attempt.wrong_count + 1
    returning wrong_count into v_wrong_count;

    return query select 'wrong_code'::text, null::uuid, greatest(0, 5 - v_wrong_count);
    return;
  end if;

  insert into public.member (user_id, name, role, status, status_at)
  values (v_uid, v_name, p_role, v_status, now())
  returning id into v_member_id;

  return query select v_status, v_member_id, greatest(0, 5 - v_wrong_count);
end;
$$;

revoke execute on function public.register(text, text, text) from public, anon;
grant execute on function public.register(text, text, text) to authenticated;

-- Admin only. null/blank clears the code; otherwise stored only as a salted
-- hash — never the plain code.
create function public.set_join_code(p_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trimmed text;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = 'P0001', hint = 'You must be signed in.';
  end if;
  if not app_private.is_admin() then
    raise exception 'not_admin' using errcode = 'P0001', hint = 'Only the admin can set the join code.';
  end if;

  v_trimmed := nullif(btrim(coalesce(p_code, '')), '');

  if v_trimmed is null then
    update public.app_setting set join_code_hash = null;
    return;
  end if;

  if length(v_trimmed) < 6 then
    raise exception 'invalid_code' using errcode = 'P0001',
      hint = 'The join code must be at least 6 characters.';
  end if;

  update public.app_setting
  set join_code_hash = extensions.crypt(v_trimmed, extensions.gen_salt('bf'));
end;
$$;

revoke execute on function public.set_join_code(text) from public, anon;
grant execute on function public.set_join_code(text) to authenticated;

-- Admin status transitions (rule 17) --------------------------------------

create function public.approve_member(p_member uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  select app_private.transition_member_status(p_member, 'waiting', 'active');
$$;

revoke execute on function public.approve_member(uuid) from public, anon;
grant execute on function public.approve_member(uuid) to authenticated;

create function public.decline_member(p_member uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  select app_private.transition_member_status(p_member, 'waiting', 'deactivated');
$$;

revoke execute on function public.decline_member(uuid) from public, anon;
grant execute on function public.decline_member(uuid) to authenticated;

create function public.deactivate_member(p_member uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  select app_private.transition_member_status(p_member, 'active', 'deactivated');
$$;

revoke execute on function public.deactivate_member(uuid) from public, anon;
grant execute on function public.deactivate_member(uuid) to authenticated;

create function public.reactivate_member(p_member uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  select app_private.transition_member_status(p_member, 'deactivated', 'active');
$$;

revoke execute on function public.reactivate_member(uuid) from public, anon;
grant execute on function public.reactivate_member(uuid) to authenticated;

-- Admin only, refused while the member has any guardian/place_host link
-- (rule 18).
create function public.set_member_role(p_member uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linked boolean;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = 'P0001', hint = 'You must be signed in.';
  end if;
  if not app_private.is_admin() then
    raise exception 'not_admin' using errcode = 'P0001', hint = 'Only the admin can change roles.';
  end if;
  if p_role is null or p_role not in ('parent', 'host') then
    raise exception 'invalid_role' using errcode = 'P0001', hint = 'Choose parent or host.';
  end if;

  if not exists (select 1 from public.member where id = p_member) then
    raise exception 'not_found' using errcode = 'P0001', hint = 'No such account.';
  end if;

  select
    exists (select 1 from public.guardian where member_id = p_member)
    or exists (select 1 from public.place_host where member_id = p_member)
  into v_linked;

  if v_linked then
    raise exception 'role_change_has_links' using errcode = 'P0001',
      hint = 'Remove this account''s links before changing its role.';
  end if;

  update public.member set role = p_role where id = p_member;
end;
$$;

revoke execute on function public.set_member_role(uuid, text) from public, anon;
grant execute on function public.set_member_role(uuid, text) to authenticated;

-- Children, homes and links (rules 10, 11, 14, 19, 20) ---------------------

-- Active parent only; becomes the child's guardian.
create function public.add_child(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_member record;
  v_name text;
  v_child_id uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = 'P0001', hint = 'You must be signed in.';
  end if;

  select id, role, status into v_member from public.member where user_id = v_uid;
  if not found or v_member.status <> 'active' then
    raise exception 'not_active' using errcode = 'P0001', hint = 'Your account is not active.';
  end if;
  if v_member.role <> 'parent' then
    raise exception 'not_parent' using errcode = 'P0001', hint = 'Only parents can add children.';
  end if;

  v_name := btrim(coalesce(p_name, ''));
  if length(v_name) < 1 or length(v_name) > 80 then
    raise exception 'invalid_name' using errcode = 'P0001', hint = 'Enter a name between 1 and 80 characters.';
  end if;

  insert into public.child (name, created_by) values (v_name, v_member.id) returning id into v_child_id;
  insert into public.guardian (member_id, child_id) values (v_member.id, v_child_id);

  return v_child_id;
end;
$$;

revoke execute on function public.add_child(text) from public, anon;
grant execute on function public.add_child(text) to authenticated;

-- A guardian of the child, or admin.
create function public.rename_child(p_child uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := app_private.my_member_id();
  v_authorized boolean;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = 'P0001', hint = 'You must be signed in.';
  end if;

  if not exists (select 1 from public.child where id = p_child) then
    raise exception 'not_found' using errcode = 'P0001', hint = 'No such child.';
  end if;

  v_authorized := app_private.is_admin()
    or (v_member_id is not null and exists (
      select 1 from public.guardian where child_id = p_child and member_id = v_member_id
    ));
  if not v_authorized then
    raise exception 'not_guardian_of_child' using errcode = 'P0001',
      hint = 'Only this child''s parents can do that.';
  end if;

  v_name := btrim(coalesce(p_name, ''));
  if length(v_name) < 1 or length(v_name) > 80 then
    raise exception 'invalid_name' using errcode = 'P0001', hint = 'Enter a name between 1 and 80 characters.';
  end if;

  update public.child set name = v_name where id = p_child;
end;
$$;

revoke execute on function public.rename_child(uuid, text) from public, anon;
grant execute on function public.rename_child(uuid, text) to authenticated;

-- Caller must be a guardian of the child (or admin). Target must be an
-- ACTIVE parent account with that email (case-insensitive). Idempotent.
create function public.add_guardian(p_child uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := app_private.my_member_id();
  v_authorized boolean;
  v_email text;
  v_target_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = 'P0001', hint = 'You must be signed in.';
  end if;

  if not exists (select 1 from public.child where id = p_child) then
    raise exception 'not_found' using errcode = 'P0001', hint = 'No such child.';
  end if;

  v_authorized := app_private.is_admin()
    or (v_member_id is not null and exists (
      select 1 from public.guardian where child_id = p_child and member_id = v_member_id
    ));
  if not v_authorized then
    raise exception 'not_guardian_of_child' using errcode = 'P0001',
      hint = 'Only this child''s parents can do that.';
  end if;

  v_email := lower(btrim(coalesce(p_email, '')));

  select m.id into v_target_id
  from public.member m
  join auth.users u on u.id = m.user_id
  where lower(u.email) = v_email
    and m.role = 'parent'
    and m.status = 'active';

  if v_target_id is null then
    raise exception 'no_parent_account' using errcode = 'P0001',
      hint = 'There is no parent account with that email.';
  end if;

  insert into public.guardian (member_id, child_id)
  values (v_target_id, p_child)
  on conflict (member_id, child_id) do nothing;
end;
$$;

revoke execute on function public.add_guardian(uuid, text) from public, anon;
grant execute on function public.add_guardian(uuid, text) to authenticated;

-- A guardian of the child (or admin). Refuses to leave the child with zero
-- guardians (rule 14); locks the child's guardian rows before counting so
-- the check and the write are atomic.
create function public.remove_guardian(p_child uuid, p_member uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := app_private.my_member_id();
  v_authorized boolean;
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = 'P0001', hint = 'You must be signed in.';
  end if;

  if not exists (select 1 from public.child where id = p_child) then
    raise exception 'not_found' using errcode = 'P0001', hint = 'No such child.';
  end if;

  v_authorized := app_private.is_admin()
    or (v_member_id is not null and exists (
      select 1 from public.guardian where child_id = p_child and member_id = v_member_id
    ));
  if not v_authorized then
    raise exception 'not_guardian_of_child' using errcode = 'P0001',
      hint = 'Only this child''s parents can do that.';
  end if;

  perform 1 from public.guardian where child_id = p_child for update;
  select count(*) into v_count from public.guardian where child_id = p_child;

  if not exists (select 1 from public.guardian where child_id = p_child and member_id = p_member) then
    -- Nothing to remove; idempotent no-op, mirroring add_guardian.
    return;
  end if;

  if v_count <= 1 then
    raise exception 'last_parent' using errcode = 'P0001',
      hint = 'Every child needs at least one parent.';
  end if;

  delete from public.guardian where child_id = p_child and member_id = p_member;
end;
$$;

revoke execute on function public.remove_guardian(uuid, uuid) from public, anon;
grant execute on function public.remove_guardian(uuid, uuid) to authenticated;

-- Active host only; becomes the place's host.
create function public.add_place(p_name text, p_address text, p_time_zone text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_member record;
  v_name text;
  v_address text;
  v_place_id uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = 'P0001', hint = 'You must be signed in.';
  end if;

  select id, role, status into v_member from public.member where user_id = v_uid;
  if not found or v_member.status <> 'active' then
    raise exception 'not_active' using errcode = 'P0001', hint = 'Your account is not active.';
  end if;
  if v_member.role <> 'host' then
    raise exception 'not_host' using errcode = 'P0001', hint = 'Only hosts can add homes.';
  end if;

  v_name := btrim(coalesce(p_name, ''));
  if length(v_name) < 1 or length(v_name) > 80 then
    raise exception 'invalid_name' using errcode = 'P0001', hint = 'Enter a name between 1 and 80 characters.';
  end if;

  v_address := nullif(btrim(coalesce(p_address, '')), '');

  if not app_private.is_valid_time_zone(p_time_zone) then
    raise exception 'invalid_time_zone' using errcode = 'P0001', hint = 'Choose a valid time zone.';
  end if;

  insert into public.place (name, address, time_zone, created_by)
  values (v_name, v_address, p_time_zone, v_member.id)
  returning id into v_place_id;

  insert into public.place_host (member_id, place_id) values (v_member.id, v_place_id);

  return v_place_id;
end;
$$;

revoke execute on function public.add_place(text, text, text) from public, anon;
grant execute on function public.add_place(text, text, text) to authenticated;

-- A host of the place, or admin.
create function public.update_place(p_place uuid, p_name text, p_address text, p_time_zone text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := app_private.my_member_id();
  v_authorized boolean;
  v_name text;
  v_address text;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = 'P0001', hint = 'You must be signed in.';
  end if;

  if not exists (select 1 from public.place where id = p_place) then
    raise exception 'not_found' using errcode = 'P0001', hint = 'No such home.';
  end if;

  v_authorized := app_private.is_admin()
    or (v_member_id is not null and exists (
      select 1 from public.place_host where place_id = p_place and member_id = v_member_id
    ));
  if not v_authorized then
    raise exception 'not_host_of_place' using errcode = 'P0001',
      hint = 'Only this home''s hosts can do that.';
  end if;

  v_name := btrim(coalesce(p_name, ''));
  if length(v_name) < 1 or length(v_name) > 80 then
    raise exception 'invalid_name' using errcode = 'P0001', hint = 'Enter a name between 1 and 80 characters.';
  end if;

  v_address := nullif(btrim(coalesce(p_address, '')), '');

  if not app_private.is_valid_time_zone(p_time_zone) then
    raise exception 'invalid_time_zone' using errcode = 'P0001', hint = 'Choose a valid time zone.';
  end if;

  update public.place
  set name = v_name, address = v_address, time_zone = p_time_zone
  where id = p_place;
end;
$$;

revoke execute on function public.update_place(uuid, text, text, text) from public, anon;
grant execute on function public.update_place(uuid, text, text, text) to authenticated;

-- Caller must be a host of the place (or admin). Target must be an ACTIVE
-- host account with that email (case-insensitive). Idempotent.
create function public.add_host(p_place uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := app_private.my_member_id();
  v_authorized boolean;
  v_email text;
  v_target_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = 'P0001', hint = 'You must be signed in.';
  end if;

  if not exists (select 1 from public.place where id = p_place) then
    raise exception 'not_found' using errcode = 'P0001', hint = 'No such home.';
  end if;

  v_authorized := app_private.is_admin()
    or (v_member_id is not null and exists (
      select 1 from public.place_host where place_id = p_place and member_id = v_member_id
    ));
  if not v_authorized then
    raise exception 'not_host_of_place' using errcode = 'P0001',
      hint = 'Only this home''s hosts can do that.';
  end if;

  v_email := lower(btrim(coalesce(p_email, '')));

  select m.id into v_target_id
  from public.member m
  join auth.users u on u.id = m.user_id
  where lower(u.email) = v_email
    and m.role = 'host'
    and m.status = 'active';

  if v_target_id is null then
    raise exception 'no_host_account' using errcode = 'P0001',
      hint = 'There is no host account with that email.';
  end if;

  insert into public.place_host (member_id, place_id)
  values (v_target_id, p_place)
  on conflict (member_id, place_id) do nothing;
end;
$$;

revoke execute on function public.add_host(uuid, text) from public, anon;
grant execute on function public.add_host(uuid, text) to authenticated;

-- A host of the place (or admin). Refuses to leave the place with zero
-- hosts (rule 20); locks the place's host rows before counting.
create function public.remove_host(p_place uuid, p_member uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := app_private.my_member_id();
  v_authorized boolean;
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = 'P0001', hint = 'You must be signed in.';
  end if;

  if not exists (select 1 from public.place where id = p_place) then
    raise exception 'not_found' using errcode = 'P0001', hint = 'No such home.';
  end if;

  v_authorized := app_private.is_admin()
    or (v_member_id is not null and exists (
      select 1 from public.place_host where place_id = p_place and member_id = v_member_id
    ));
  if not v_authorized then
    raise exception 'not_host_of_place' using errcode = 'P0001',
      hint = 'Only this home''s hosts can do that.';
  end if;

  perform 1 from public.place_host where place_id = p_place for update;
  select count(*) into v_count from public.place_host where place_id = p_place;

  if not exists (select 1 from public.place_host where place_id = p_place and member_id = p_member) then
    -- Nothing to remove; idempotent no-op, mirroring add_host.
    return;
  end if;

  if v_count <= 1 then
    raise exception 'last_host' using errcode = 'P0001', hint = 'Every home needs at least one host.';
  end if;

  delete from public.place_host where place_id = p_place and member_id = p_member;
end;
$$;

revoke execute on function public.remove_host(uuid, uuid) from public, anon;
grant execute on function public.remove_host(uuid, uuid) to authenticated;

-- Admin-by-id linking, for the admin page (admin only). Linking a member
-- whose role doesn't match the span is refused (rule 11); unlinking still
-- respects last_parent.
create function public.admin_set_guardian(p_child uuid, p_member uuid, p_linked boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = 'P0001', hint = 'You must be signed in.';
  end if;
  if not app_private.is_admin() then
    raise exception 'not_admin' using errcode = 'P0001', hint = 'Only the admin can do that.';
  end if;

  if not exists (select 1 from public.child where id = p_child) then
    raise exception 'not_found' using errcode = 'P0001', hint = 'No such child.';
  end if;
  if not exists (select 1 from public.member where id = p_member) then
    raise exception 'not_found' using errcode = 'P0001', hint = 'No such account.';
  end if;

  if p_linked then
    select role into v_role from public.member where id = p_member;
    if v_role <> 'parent' then
      raise exception 'link_role_mismatch' using errcode = 'P0001',
        hint = 'Only parent accounts can be a child''s parent.';
    end if;
    insert into public.guardian (member_id, child_id) values (p_member, p_child)
    on conflict (member_id, child_id) do nothing;
  else
    perform 1 from public.guardian where child_id = p_child for update;
    select count(*) into v_count from public.guardian where child_id = p_child;

    if not exists (select 1 from public.guardian where child_id = p_child and member_id = p_member) then
      return;
    end if;

    if v_count <= 1 then
      raise exception 'last_parent' using errcode = 'P0001',
        hint = 'Every child needs at least one parent.';
    end if;

    delete from public.guardian where child_id = p_child and member_id = p_member;
  end if;
end;
$$;

revoke execute on function public.admin_set_guardian(uuid, uuid, boolean) from public, anon;
grant execute on function public.admin_set_guardian(uuid, uuid, boolean) to authenticated;

-- Admin-by-id linking for hosts, mirroring admin_set_guardian.
create function public.admin_set_host(p_place uuid, p_member uuid, p_linked boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = 'P0001', hint = 'You must be signed in.';
  end if;
  if not app_private.is_admin() then
    raise exception 'not_admin' using errcode = 'P0001', hint = 'Only the admin can do that.';
  end if;

  if not exists (select 1 from public.place where id = p_place) then
    raise exception 'not_found' using errcode = 'P0001', hint = 'No such home.';
  end if;
  if not exists (select 1 from public.member where id = p_member) then
    raise exception 'not_found' using errcode = 'P0001', hint = 'No such account.';
  end if;

  if p_linked then
    select role into v_role from public.member where id = p_member;
    if v_role <> 'host' then
      raise exception 'link_role_mismatch' using errcode = 'P0001',
        hint = 'Only host accounts can host a home.';
    end if;
    insert into public.place_host (member_id, place_id) values (p_member, p_place)
    on conflict (member_id, place_id) do nothing;
  else
    perform 1 from public.place_host where place_id = p_place for update;
    select count(*) into v_count from public.place_host where place_id = p_place;

    if not exists (select 1 from public.place_host where place_id = p_place and member_id = p_member) then
      return;
    end if;

    if v_count <= 1 then
      raise exception 'last_host' using errcode = 'P0001', hint = 'Every home needs at least one host.';
    end if;

    delete from public.place_host where place_id = p_place and member_id = p_member;
  end if;
end;
$$;

revoke execute on function public.admin_set_host(uuid, uuid, boolean) from public, anon;
grant execute on function public.admin_set_host(uuid, uuid, boolean) to authenticated;

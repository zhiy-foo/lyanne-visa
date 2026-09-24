-- Admin delete of a deactivated member with no history (ARCHITECTURE.md §6
-- rule 17 exception, decided 2026-09-24). Mirrors the conventions in
-- 20260924000300_foundation_functions.sql: security definer,
-- set search_path = '', fully-qualified names, closed-list P0001 codes,
-- explicit revoke/grant, every UPDATE/DELETE has a WHERE.

-- True iff the member has any guardian or place_host row, or is created_by
-- of any child or place. Every future table that references a member
-- (applications/moves, templates, dispatches, ...) MUST be added here, or a
-- member with real history could be deleted out from under it.
create function app_private.member_has_history(p_member uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (select 1 from public.guardian where member_id = p_member)
    or exists (select 1 from public.place_host where member_id = p_member)
    or exists (select 1 from public.child where created_by = p_member)
    or exists (select 1 from public.place where created_by = p_member);
$$;

revoke execute on function app_private.member_has_history(uuid) from public;

-- Admin only: ids of deactivated members with no history — exactly the
-- accounts admin_delete_member will accept.
create function public.admin_deletable_member_ids()
returns setof uuid
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
    raise exception 'not_admin' using errcode = 'P0001', hint = 'Only the admin can view deletable accounts.';
  end if;

  return query
  select m.id
  from public.member m
  where m.status = 'deactivated'
    and not app_private.member_has_history(m.id);
end;
$$;

revoke execute on function public.admin_deletable_member_ids() from public, anon;
grant execute on function public.admin_deletable_member_ids() to authenticated;

-- Admin only. Refuses (not_found) if the member does not exist, and refuses
-- (not_deletable) unless the member is deactivated with no history. Locks
-- the member row first so the check and the delete are atomic under
-- concurrent calls. Deletes the member row and that identity's join_attempt
-- row only — auth.users is left untouched, so the person can sign in again;
-- doing so re-registers them onto the waiting list (register()'s
-- already_registered check no longer finds a member row, and there is no
-- special-case here that lets them skip straight back to active).
create function public.admin_delete_member(p_member uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = 'P0001', hint = 'You must be signed in.';
  end if;
  if not app_private.is_admin() then
    raise exception 'not_admin' using errcode = 'P0001', hint = 'Only the admin can delete accounts.';
  end if;

  select status, user_id into v_status, v_user_id
  from public.member where id = p_member for update;

  if not found then
    raise exception 'not_found' using errcode = 'P0001', hint = 'No such account.';
  end if;

  if v_status <> 'deactivated' or app_private.member_has_history(p_member) then
    raise exception 'not_deletable' using errcode = 'P0001',
      hint = 'Only deactivated accounts with no history can be deleted.';
  end if;

  delete from public.join_attempt where user_id = v_user_id;
  delete from public.member where id = p_member;
end;
$$;

revoke execute on function public.admin_delete_member(uuid) from public, anon;
grant execute on function public.admin_delete_member(uuid) to authenticated;

-- Whether the family join code is currently set, for the admin page
-- (AdminAccountsProps.joinCodeSet in src/ui/types.ts). No existing function exposes
-- this: my_account() only reports the caller's own attempts-left, and the
-- hash itself must never leave the database. Admin only, mirrors the
-- conventions in 20260924000300_foundation_functions.sql.

create function public.join_code_is_set()
returns boolean
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
    raise exception 'not_admin' using errcode = 'P0001', hint = 'Only the admin can view the join code status.';
  end if;

  return exists (
    select 1 from public.app_setting where join_code_hash is not null
  );
end;
$$;

revoke execute on function public.join_code_is_set() from public, anon;
grant execute on function public.join_code_is_set() to authenticated;

-- Fix set_join_code: Supabase's hosted Postgres runs the pg-safeupdate
-- extension, which rejects any UPDATE/DELETE issued over the API without a
-- WHERE clause ("UPDATE requires a WHERE clause"). The set_join_code defined
-- in 20260924000300_foundation_functions.sql updates app_setting (a
-- singleton row, `id boolean primary key default true check (id)`) with no
-- WHERE clause on either branch (clear and set), so every call fails on the
-- hosted database with a generic error — even though our PGlite test
-- database has no such guard and the existing tests pass. This migration
-- replaces the function with an identical body except both updates now
-- target `where id = true`, matching the table's one possible row.
create or replace function public.set_join_code(p_code text)
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
    update public.app_setting set join_code_hash = null where id = true;
    return;
  end if;

  if length(v_trimmed) < 6 then
    raise exception 'invalid_code' using errcode = 'P0001',
      hint = 'The join code must be at least 6 characters.';
  end if;

  update public.app_setting
  set join_code_hash = extensions.crypt(v_trimmed, extensions.gen_salt('bf'))
  where id = true;
end;
$$;

revoke execute on function public.set_join_code(text) from public, anon;
grant execute on function public.set_join_code(text) to authenticated;

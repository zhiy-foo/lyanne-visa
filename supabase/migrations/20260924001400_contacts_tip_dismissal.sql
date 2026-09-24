-- ui-design-brief.md §5 "Stage 4" contacts tip: dismissal moves from the
-- browser's localStorage (see docs/delivery/STATUS.md's prior "Needs work"
-- note) to a per-account flag on `member`, so it does not reappear after
-- clearing browser storage or on a new device, and cannot be spoofed to
-- another member's row — the caller is always resolved server-side from
-- auth.uid(), same as every other write in
-- 20260924000300_foundation_functions.sql.

alter table member add column contacts_tip_dismissed_at timestamptz null;

-- Read: has the caller's own member row dismissed the tip? False (not an
-- error) for a signed-in but non-active caller (my_member_id() is null),
-- matching the "acceptable to show again" spirit of the original
-- localStorage version rather than raising for a low-stakes read. A
-- signed-out caller never reaches the function body at all — like every
-- other function here, execute is granted to `authenticated` only.
create function public.contacts_tip_dismissed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.member
    where id = app_private.my_member_id()
      and contacts_tip_dismissed_at is not null
  );
$$;

revoke execute on function public.contacts_tip_dismissed() from public, anon;
grant execute on function public.contacts_tip_dismissed() to authenticated;

-- Write: the caller's own row only — no target member id parameter exists,
-- so there is nothing to spoof (Law 1: caller resolved from auth.uid()
-- inside the function body, never trusted from the browser).
create function public.dismiss_contacts_tip()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := app_private.my_member_id();
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = 'P0001', hint = 'You must be signed in.';
  end if;

  if v_member_id is null then
    raise exception 'not_active' using errcode = 'P0001', hint = 'Your account is not active.';
  end if;

  update public.member
  set contacts_tip_dismissed_at = now()
  where id = v_member_id;
end;
$$;

revoke execute on function public.dismiss_contacts_tip() from public, anon;
grant execute on function public.dismiss_contacts_tip() to authenticated;

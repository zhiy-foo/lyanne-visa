-- Stays reads: authorization-checked read functions the data loaders (task
-- 5.3) call, plus the host capacity write (task 2's "if none exists").
-- `app_private.fold_application` (20260924000900) is deliberately not
-- granted to clients — it performs no visibility check of its own — so this
-- migration adds the checked entry points that do.

-- public.my_applications (task 4.2's "Read functions") ----------------------
-- Every application the caller may see (rule 12 / application_select's own
-- predicate, mirrored here rather than reused because RLS on `application`
-- filters rows, not columns computed by folding `move`): guardian of the
-- child, host of the place, or admin. Returns everything a loader needs to
-- render Overview/Applications without a second round trip: the folded
-- status, the caller's own side (null for the admin, who has none), and
-- child/place display facts. `last_move_at` lets a loader sort "most
-- recently active first" without a second query.
create function public.my_applications()
returns table (
  application_id uuid,
  child_id uuid,
  child_name text,
  place_id uuid,
  place_name text,
  place_time_zone text,
  status text,
  awaiting text,
  agreed_start date,
  agreed_end date,
  open_start date,
  open_end date,
  open_side text,
  revision int,
  viewer_side text,
  last_move_at timestamptz
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
    a.id,
    a.child_id,
    c.name,
    a.place_id,
    p.name,
    p.time_zone,
    f.status,
    f.awaiting,
    f.agreed_start,
    f.agreed_end,
    f.open_start,
    f.open_end,
    f.open_side,
    f.revision,
    case
      when a.child_id in (select app_private.my_child_ids()) then 'parent'
      when a.place_id in (select app_private.my_place_ids()) then 'host'
      else null
    end,
    (select max(m.at) from public.move m where m.application_id = a.id)
  from public.application a
  join public.child c on c.id = a.child_id
  join public.place p on p.id = a.place_id
  cross join lateral app_private.fold_application(a.id) f
  where a.id in (select app_private.my_application_ids())
     or app_private.is_admin();
end;
$$;

revoke execute on function public.my_applications() from public, anon;
grant execute on function public.my_applications() to authenticated;

-- public.application_moves (task 4.2) ----------------------------------------
-- The move history for one application, with each mover's display *name*.
-- `member_select` RLS does not let a parent see a host member row (or vice
-- versa), so names must be produced here, inside a SECURITY DEFINER function
-- that has already authorized the caller for this application — never a
-- user_id/email, per the design's "expose name only" instruction.
create function public.application_moves(p_application uuid)
returns table (
  move_id uuid,
  kind text,
  side text,
  by_name text,
  at timestamptz,
  date_start date,
  date_end date,
  note text
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

  if not (
    p_application in (select app_private.my_application_ids())
    or app_private.is_admin()
  ) then
    raise exception 'not_participant' using errcode = 'P0001',
      hint = 'Only this application''s parents or hosts can see its history.';
  end if;

  return query
  select m.id, m.kind, m.side, mem.name, m.at, m.date_start, m.date_end, m.note
  from public.move m
  join public.member mem on mem.id = m.by
  where m.application_id = p_application
  order by m.seq;
end;
$$;

revoke execute on function public.application_moves(uuid) from public, anon;
grant execute on function public.application_moves(uuid) to authenticated;

-- public.application_participants (design Decision 7 / ARCHITECTURE.md §8
-- "participants") ------------------------------------------------------------
-- The active members of guardians(a_child) ∪ hosts(a_place) — what
-- src/stayover/events.ts's `participants` needs to build a StayoverEvent for
-- email-delivery to consume. A SECURITY DEFINER function, not a plain client
-- query, because `member_select`/`place_host_select` RLS does not let a
-- parent read a host member row (or vice versa) — this authorizes the caller
-- as a participant of the application first, then returns both sides'
-- emails (unlike application_moves, which deliberately withholds email —
-- this is the one read email-delivery needs it for, per ARCHITECTURE.md §8).
create function public.application_participants(p_application uuid)
returns table (member_id uuid, name text, email text, side text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_child uuid;
  v_place uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = 'P0001', hint = 'You must be signed in.';
  end if;

  select a.child_id, a.place_id into v_child, v_place from public.application a where a.id = p_application;
  if not found then
    raise exception 'not_found' using errcode = 'P0001', hint = 'No such application.';
  end if;

  if not (
    p_application in (select app_private.my_application_ids())
    or app_private.is_admin()
  ) then
    raise exception 'not_participant' using errcode = 'P0001',
      hint = 'Only this application''s parents or hosts can see its participants.';
  end if;

  return query
  select m.id, m.name, (select lower(u.email) from auth.users u where u.id = m.user_id), 'parent'::text
  from public.member m
  join public.guardian g on g.member_id = m.id
  where g.child_id = v_child and m.status = 'active'
  union
  select m.id, m.name, (select lower(u.email) from auth.users u where u.id = m.user_id), 'host'::text
  from public.member m
  join public.place_host ph on ph.member_id = m.id
  where ph.place_id = v_place and m.status = 'active';
end;
$$;

revoke execute on function public.application_participants(uuid) from public, anon;
grant execute on function public.application_participants(uuid) to authenticated;

-- public.set_place_capacity (task 2's capacity write) ------------------------
-- Foundation's update_place (20260924000300) has no capacity parameter, so
-- this is a separate, single-purpose write, mirroring the "one function per
-- distinct concern" shape of add_host/remove_host alongside update_place. A
-- host of the place, or the admin; p_capacity null clears the limit
-- (design.md Decision 5 / spec "No capacity set means no limit").
create function public.set_place_capacity(p_place uuid, p_capacity int default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := app_private.my_member_id();
  v_authorized boolean;
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

  if p_capacity is not null and p_capacity <= 0 then
    raise exception 'invalid_capacity' using errcode = 'P0001',
      hint = 'Capacity must be a positive number, or left blank for no limit.';
  end if;

  update public.place set capacity = p_capacity where id = p_place;
end;
$$;

revoke execute on function public.set_place_capacity(uuid, int) from public, anon;
grant execute on function public.set_place_capacity(uuid, int) to authenticated;

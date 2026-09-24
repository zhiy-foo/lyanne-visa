-- Stays functions: the fold, move-writing, capacity read and hard delete
-- (design.md Decisions 2-6; ARCHITECTURE.md §5, §6 rules 2-4, 6, 13).
-- Conventions match 20260924000300_foundation_functions.sql: schema public
-- (Supabase RPC), `security definer set search_path = ''`, every name
-- schema-qualified, closed-list P0001 codes with a hint, explicit
-- `revoke ... from public, anon;` then `grant ... to authenticated;`, every
-- UPDATE/DELETE has a WHERE clause.

-- app_private.fold_application (design Decision 2) --------------------------
-- Implements the §5 state table by scanning `move` ordered by `seq` (a
-- monotonic tie-breaker for `at`, since two moves in the same call/test can
-- share a timestamp). Every read path (record_move, open_application,
-- place_capacity_status, delete_application, and later the data loaders in
-- task 5) goes through this one function, so the fold is defined exactly
-- once (rule 5 — status/agreed dates/turn are deduced, never stored).
--
-- Deliberately NOT granted to authenticated (see the comment below the
-- function): it performs no visibility check of its own.
create function app_private.fold_application(p_application uuid)
returns table (
  status text,
  awaiting text,
  agreed_start date,
  agreed_end date,
  open_start date,
  open_end date,
  open_side text,
  revision int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_phase text := null;
  v_awaiting text := null;
  v_agreed_start date := null;
  v_agreed_end date := null;
  v_open_start date := null;
  v_open_end date := null;
  v_open_side text := null;
  v_revision int := 0;
  v_move record;
begin
  for v_move in
    select m.kind, m.side, m.date_start, m.date_end
    from public.move m
    where m.application_id = p_application
    order by m.seq
  loop
    if v_move.kind = 'propose' then
      v_open_start := v_move.date_start;
      v_open_end := v_move.date_end;
      v_open_side := v_move.side;
      v_awaiting := case v_move.side when 'parent' then 'host' else 'parent' end;
      -- NEGOTIATING the first time; a PROPOSE after an existing agreement
      -- leaves the phase CONFIRMED (change pending) per the §5 table.
      if v_agreed_start is not null then
        v_phase := 'confirmed';
      else
        v_phase := 'negotiating';
      end if;

    elsif v_move.kind = 'accept' then
      v_agreed_start := v_open_start;
      v_agreed_end := v_open_end;
      v_open_start := null;
      v_open_end := null;
      v_open_side := null;
      v_awaiting := null;
      v_phase := 'confirmed';
      -- revision: "an ACCEPT or a CANCEL after agreement" changed agreed?.
      v_revision := v_revision + 1;

    elsif v_move.kind = 'reject' then
      v_open_start := null;
      v_open_end := null;
      v_open_side := null;
      v_awaiting := null;
      if v_agreed_start is not null then
        v_phase := 'confirmed'; -- agreement unchanged
      else
        v_phase := 'rejected'; -- terminal
      end if;

    elsif v_move.kind = 'cancel' then
      if v_agreed_start is not null then
        v_revision := v_revision + 1; -- agreed? is changing (cleared) below
      end if;
      v_agreed_start := null;
      v_agreed_end := null;
      v_open_start := null;
      v_open_end := null;
      v_open_side := null;
      v_awaiting := null;
      v_phase := 'cancelled'; -- terminal
    end if;
  end loop;

  return query
  select v_phase, v_awaiting, v_agreed_start, v_agreed_end, v_open_start, v_open_end, v_open_side, v_revision;
end;
$$;

revoke execute on function app_private.fold_application(uuid) from public;
-- No grant to authenticated: fold_application reads `move` directly and
-- performs no rule-12 visibility check of its own, so granting it directly
-- would let any authenticated caller read any application's status by id.
-- It is called only from inside the SECURITY DEFINER functions below, each
-- of which authorizes the caller first; a future authorization-checked
-- public read function (task 5, data loaders) is the intended client path.

-- public.record_move (design Decision 3, 4) ---------------------------------
-- One function for all four move kinds — see design.md Decision 3 for why
-- (the legality table, side resolution and transactional guard are
-- identical across kinds). Returns enough of the before/after state
-- (Decision 7) for the caller to build a `MoveCommitted` StayoverEvent.
create function public.record_move(
  p_application uuid,
  p_kind text,
  p_date_start date default null,
  p_date_end date default null,
  p_note text default null
)
returns table (
  move_id uuid,
  application_id uuid,
  child_id uuid,
  place_id uuid,
  kind text,
  side text,
  by uuid,
  at timestamptz,
  date_start date,
  date_end date,
  note text,
  status_before text,
  status_after text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_member_id uuid;
  v_child uuid;
  v_place uuid;
  v_side text;
  v_fold record;
  v_note text;
  v_move_id uuid;
  v_by uuid;
  v_at timestamptz;
  v_date_start date;
  v_date_end date;
  v_status_after text;
  v_capacity int;
  v_conflict record;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = 'P0001', hint = 'You must be signed in.';
  end if;

  if p_kind is null or p_kind not in ('propose', 'accept', 'reject', 'cancel') then
    raise exception 'invalid_kind' using errcode = 'P0001', hint = 'Unknown move kind.';
  end if;

  v_member_id := app_private.my_member_id();

  -- Lock the application row first so two concurrent moves on the *same*
  -- application (e.g. counter-proposals racing) are serialized before
  -- either reads the folded state — the fold+insert below is then atomic.
  select a.child_id, a.place_id into v_child, v_place
  from public.application a
  where a.id = p_application
  for update;

  if not found then
    raise exception 'not_found' using errcode = 'P0001', hint = 'No such application.';
  end if;

  -- side (§4 morphism table), resolved only through my_child_ids()/
  -- my_place_ids() — never a raw guardian/place_host join (insulates this
  -- change from co-parent-requests, design Decision 3).
  if v_child in (select app_private.my_child_ids()) then
    v_side := 'parent';
  elsif v_place in (select app_private.my_place_ids()) then
    v_side := 'host';
  else
    v_side := null;
  end if;

  if v_side is null then
    -- Covers an uninvolved member and the admin, who has no Member row and
    -- so no side (task 3.3 — "admin reads, never acts").
    raise exception 'not_participant' using errcode = 'P0001',
      hint = 'Only this application''s parents or hosts can do that.';
  end if;

  select * into v_fold from app_private.fold_application(p_application);

  if v_fold.status in ('rejected', 'cancelled') then
    raise exception 'application_closed' using errcode = 'P0001',
      hint = 'This application is already declined or cancelled.';
  end if;

  v_note := nullif(btrim(coalesce(p_note, '')), '');
  if v_note is not null and length(v_note) > 2000 then
    raise exception 'invalid_note' using errcode = 'P0001', hint = 'Note is too long.';
  end if;

  if p_kind = 'propose' then
    if p_date_start is null or p_date_end is null or p_date_start >= p_date_end then
      raise exception 'invalid_dates' using errcode = 'P0001',
        hint = 'The pick-up day must be after the drop-off day.';
    end if;
    v_date_start := p_date_start;
    v_date_end := p_date_end;

    insert into public.move as m (application_id, kind, side, by, date_start, date_end, note)
    values (p_application, 'propose', v_side, v_member_id, v_date_start, v_date_end, v_note)
    returning m.id, m.by, m.at into v_move_id, v_by, v_at;

  elsif p_kind = 'reject' then
    if v_fold.open_start is null then
      raise exception 'no_open_proposal' using errcode = 'P0001',
        hint = 'There is nothing open to reject.';
    end if;
    if v_fold.open_side = v_side then
      raise exception 'cannot_answer_own_proposal' using errcode = 'P0001',
        hint = 'You cannot reject your own proposal.';
    end if;

    insert into public.move as m (application_id, kind, side, by, note)
    values (p_application, 'reject', v_side, v_member_id, v_note)
    returning m.id, m.by, m.at into v_move_id, v_by, v_at;

  elsif p_kind = 'cancel' then
    -- Either side may cancel at any time before a terminal phase (already
    -- guaranteed above); no open-proposal/side restriction.
    insert into public.move as m (application_id, kind, side, by, note)
    values (p_application, 'cancel', v_side, v_member_id, v_note)
    returning m.id, m.by, m.at into v_move_id, v_by, v_at;

  elsif p_kind = 'accept' then
    if v_fold.open_start is null then
      raise exception 'no_open_proposal' using errcode = 'P0001',
        hint = 'There is nothing open to accept.';
    end if;
    if v_fold.open_side = v_side then
      raise exception 'cannot_answer_own_proposal' using errcode = 'P0001',
        hint = 'You cannot accept your own proposal.';
    end if;

    v_date_start := v_fold.open_start;
    v_date_end := v_fold.open_end;

    -- Overlap (rule 6) and capacity (design Decision 4) are checked only
    -- for an accept that sets/moves agreed?, inside this locked section:
    -- lock the child row, then the place row, before counting — mirrors
    -- foundation's last-parent/last-host pattern. A tstzrange exclusion
    -- constraint is deliberately NOT used (see 20260924000700_stays_schema
    -- .sql's task 1.2 comment) — agreed? has no stored column to index, and
    -- capacity needs a count over n rows, which an exclusion constraint
    -- cannot express. A true concurrent-accept race cannot be exercised
    -- against PGlite (one connection) — see the note in
    -- test/db/stays-functions.test.ts; this locking is verified on hosted
    -- Supabase later.
    perform 1 from public.child where id = v_child for update;

    select a.id into v_conflict
    from public.application a
    cross join lateral app_private.fold_application(a.id) f
    where a.child_id = v_child
      and a.id <> p_application
      and f.agreed_start is not null
      and f.agreed_start < v_date_end
      and f.agreed_end > v_date_start
    limit 1;

    if found then
      raise exception 'overlap_conflict' using errcode = 'P0001',
        hint = 'These dates overlap another confirmed stay for this child.';
    end if;

    select p.capacity into v_capacity from public.place p where p.id = v_place for update;

    if v_capacity is not null then
      if exists (
        with other_agreed as (
          select a.child_id, f.agreed_start, f.agreed_end
          from public.application a
          cross join lateral app_private.fold_application(a.id) f
          where a.place_id = v_place
            and a.id <> p_application
            and f.agreed_start is not null
        )
        select 1
        from generate_series(v_date_start, v_date_end - interval '1 day', interval '1 day') as g(night)
        where (
          select count(distinct oa.child_id)
          from other_agreed oa
          where oa.agreed_start <= g.night::date and oa.agreed_end > g.night::date
        ) + 1 > v_capacity
      ) then
        raise exception 'capacity_exceeded' using errcode = 'P0001',
          hint = 'That would put more children at this home on one night than its capacity allows.';
      end if;
    end if;

    insert into public.move as m (application_id, kind, side, by, note)
    values (p_application, 'accept', v_side, v_member_id, v_note)
    returning m.id, m.by, m.at into v_move_id, v_by, v_at;
  end if;

  select f.status into v_status_after from app_private.fold_application(p_application) f;

  return query
  select
    v_move_id, p_application, v_child, v_place, p_kind, v_side, v_by, v_at,
    v_date_start, v_date_end, v_note, v_fold.status, v_status_after;
end;
$$;

revoke execute on function public.record_move(uuid, text, date, date, text) from public, anon;
grant execute on function public.record_move(uuid, text, date, date, text) to authenticated;

-- public.open_application (design Decision 3, rule 3) -----------------------
-- Active parent guardian of the child only; creates the application and its
-- first move, a PROPOSE by the parents' side (rule 3).
create function public.open_application(
  p_child uuid,
  p_place uuid,
  p_date_start date,
  p_date_end date,
  p_note text default null
)
returns table (
  application_id uuid,
  move_id uuid,
  child_id uuid,
  place_id uuid,
  kind text,
  side text,
  by uuid,
  at timestamptz,
  date_start date,
  date_end date,
  note text,
  status_after text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_member record;
  v_note text;
  v_app_id uuid;
  v_move_id uuid;
  v_by uuid;
  v_at timestamptz;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = 'P0001', hint = 'You must be signed in.';
  end if;

  select id, role, status into v_member from public.member where user_id = v_uid;
  if not found or v_member.status <> 'active' then
    raise exception 'not_active' using errcode = 'P0001', hint = 'Your account is not active.';
  end if;
  if v_member.role <> 'parent' then
    raise exception 'not_parent' using errcode = 'P0001', hint = 'Only parents can open an application.';
  end if;

  if not exists (select 1 from public.child where id = p_child) then
    raise exception 'not_found' using errcode = 'P0001', hint = 'No such child.';
  end if;
  if not exists (select 1 from public.place where id = p_place) then
    raise exception 'not_found' using errcode = 'P0001', hint = 'No such home.';
  end if;

  -- Resolved through app_private.my_child_ids() (never a raw guardian join,
  -- design Decision 3) — insulates this from co-parent-requests, same as
  -- record_move.
  if p_child not in (select app_private.my_child_ids()) then
    raise exception 'not_guardian_of_child' using errcode = 'P0001',
      hint = 'Only this child''s parents can apply for them.';
  end if;

  if p_date_start is null or p_date_end is null or p_date_start >= p_date_end then
    raise exception 'invalid_dates' using errcode = 'P0001',
      hint = 'The pick-up day must be after the drop-off day.';
  end if;

  v_note := nullif(btrim(coalesce(p_note, '')), '');
  if v_note is not null and length(v_note) > 2000 then
    raise exception 'invalid_note' using errcode = 'P0001', hint = 'Note is too long.';
  end if;

  insert into public.application (child_id, place_id, created_by)
  values (p_child, p_place, v_member.id)
  returning id into v_app_id;

  insert into public.move as m (application_id, kind, side, by, date_start, date_end, note)
  values (v_app_id, 'propose', 'parent', v_member.id, p_date_start, p_date_end, v_note)
  returning m.id, m.by, m.at into v_move_id, v_by, v_at;

  return query
  select v_app_id, v_move_id, p_child, p_place, 'propose'::text, 'parent'::text, v_by, v_at,
         p_date_start, p_date_end, v_note, 'negotiating'::text;
end;
$$;

revoke execute on function public.open_application(uuid, uuid, date, date, text) from public, anon;
grant execute on function public.open_application(uuid, uuid, date, date, text) to authenticated;

-- public.place_capacity_status (design Decision 5) ---------------------------
-- A read, not a refusal (proposals are never blocked for capacity, only
-- accepts are). Any active member or the admin may call it for any place —
-- a parent needs it for a place they have not applied to yet, to decide
-- whether to show the warning before their first proposal.
create function public.place_capacity_status(p_place uuid, p_date_start date, p_date_end date)
returns table (night date, agreed_count int, at_capacity boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_capacity int;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = 'P0001', hint = 'You must be signed in.';
  end if;
  if app_private.my_member_id() is null and not app_private.is_admin() then
    raise exception 'not_active' using errcode = 'P0001', hint = 'Your account is not active.';
  end if;

  if not exists (select 1 from public.place where id = p_place) then
    raise exception 'not_found' using errcode = 'P0001', hint = 'No such home.';
  end if;

  if p_date_start is null or p_date_end is null or p_date_start >= p_date_end then
    raise exception 'invalid_dates' using errcode = 'P0001',
      hint = 'The pick-up day must be after the drop-off day.';
  end if;

  select p.capacity into v_capacity from public.place p where p.id = p_place;

  return query
  with agreed as (
    select a.child_id, f.agreed_start, f.agreed_end
    from public.application a
    cross join lateral app_private.fold_application(a.id) f
    where a.place_id = p_place and f.agreed_start is not null
  ),
  nights as (
    select g.night::date as night
    from generate_series(p_date_start, p_date_end - interval '1 day', interval '1 day') as g(night)
  )
  select
    n.night,
    count(distinct ag.child_id)::int as agreed_count,
    v_capacity is not null and count(distinct ag.child_id) >= v_capacity as at_capacity
  from nights n
  left join agreed ag on ag.agreed_start <= n.night and ag.agreed_end > n.night
  group by n.night
  order by n.night;
end;
$$;

revoke execute on function public.place_capacity_status(uuid, date, date) from public, anon;
grant execute on function public.place_capacity_status(uuid, date, date) to authenticated;

-- public.delete_application (design Decision 6, rule 13) --------------------
-- A parent guardian of the child, only while every move's side is 'parent'
-- (no host has responded). Snapshots what the caller needs to build an
-- ApplicationDeleted StayoverEvent before deleting, since the row is gone
-- afterwards.
create function public.delete_application(p_application uuid)
returns table (
  child_name text,
  place_name text,
  host_member_ids uuid[],
  agreed_start date,
  agreed_end date,
  open_start date,
  open_end date
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_member_id uuid;
  v_child uuid;
  v_place uuid;
  v_fold record;
  v_child_name text;
  v_place_name text;
  v_hosts uuid[];
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = 'P0001', hint = 'You must be signed in.';
  end if;

  v_member_id := app_private.my_member_id();

  select a.child_id, a.place_id into v_child, v_place
  from public.application a
  where a.id = p_application
  for update;

  if not found then
    raise exception 'not_found' using errcode = 'P0001', hint = 'No such application.';
  end if;

  -- Resolved through app_private.my_child_ids() (never a raw guardian join,
  -- design Decision 3) — insulates this from co-parent-requests, same as
  -- record_move. Covers a host (never guardian of the child), an uninvolved
  -- member and the admin (no Member row) alike — none of them can
  -- hard-delete.
  if v_child not in (select app_private.my_child_ids()) then
    raise exception 'not_guardian_of_child' using errcode = 'P0001',
      hint = 'Only this child''s parents can delete an application.';
  end if;

  if exists (select 1 from public.move where application_id = p_application and side = 'host') then
    raise exception 'already_answered' using errcode = 'P0001',
      hint = 'A host has responded — cancel it instead of deleting it.';
  end if;

  select * into v_fold from app_private.fold_application(p_application);

  select c.name into v_child_name from public.child c where c.id = v_child;
  select p.name into v_place_name from public.place p where p.id = v_place;
  select coalesce(array_agg(ph.member_id), '{}') into v_hosts
  from public.place_host ph where ph.place_id = v_place;

  delete from public.move where application_id = p_application;
  delete from public.application where id = p_application;

  return query
  select v_child_name, v_place_name, v_hosts, v_fold.agreed_start, v_fold.agreed_end, v_fold.open_start, v_fold.open_end;
end;
$$;

revoke execute on function public.delete_application(uuid) from public, anon;
grant execute on function public.delete_application(uuid) to authenticated;

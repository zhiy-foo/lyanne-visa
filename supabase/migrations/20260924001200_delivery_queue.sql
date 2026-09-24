-- Delivery queue: extends stays' `record_move`/`open_application`/
-- `delete_application` and foundation's `register` to insert `dispatch` rows
-- in the same transaction as the domain write (design.md Decision a, d;
-- tasks.md 2.1, 2.2). Each function below is started from its LATEST
-- definition (record_move/open_application/delete_application from
-- 20260924000900_stays_functions.sql, register from
-- 20260924000300_foundation_functions.sql — grepped, register is never
-- redefined after 000300) with every existing statement, signature, return
-- shape and error code preserved byte-for-byte; the only change is the
-- dispatch insert(s) added at the end, after the domain write already
-- committed its own rows within the transaction (composition rule 1: "after
-- the Stayover change is durable" — durable within the transaction, sent
-- only after the transaction and the caller's response, per design.md
-- Decision b).
--
-- Rendering-without-RLS choice (task brief point 2): a `payload jsonb`
-- snapshot column on `dispatch`, populated at insert time, NOT a secret-gated
-- `dispatch_render_facts` function. Chosen because:
--   1. `delete_application` already has to snapshot everything it needs
--      before deleting the row (design.md Decision 6) — a payload column is
--      the same idea, generalised to every dispatch kind, rather than a
--      second, parallel secret-gated read path.
--   2. It costs nothing extra at read time: `sendPendingDispatches` already
--      claims the row via the worker-secret-gated `claim_pending_dispatches`
--      (20260924001100_delivery_outbox.sql) — the payload rides along on the
--      same already-authorized row, with no second RPC call.
--   3. A `dispatch_render_facts` function would have to be granted to
--      `authenticated` (nothing else could call it) and would then need its
--      OWN worker-secret gate to avoid the same "any signed-in identity can
--      read any application's facts" hole the outbox migration's security
--      fix already had to close once for claim/record — a payload column
--      avoids inventing a second such surface.
--   4. It is exactly what design.md Decision a already committed to for
--      `to_email` ("nothing downstream ... needs to read auth.users again;
--      the sensitive read happens exactly once, at the moment of the write
--      it is caused by") — extending the same principle to every other fact
--      a render needs, not just the address.
-- Tested in test/db/delivery-queue.test.ts: each queued row's payload is
-- asserted to carry everything renderNotice/buildEvent need with no further
-- read, including for a hard-deleted application (payload survives even
-- though `application_id` itself is nulled by the FK's `on delete set null`).

alter table dispatch add column payload jsonb not null default '{}'::jsonb;

comment on column dispatch.payload is
  'Snapshot of every fact a render needs, taken at insert time by the
   SECURITY DEFINER function that queued this row — never re-read from the
   database at send time, so sending never depends on the caller''s own RLS
   visibility (design.md Decision a; migration header comment above).';

-- app_private.stayover_side_members (helper, this migration only) ----------
-- Active members on one side of an application: guardians of p_child for
-- 'parent', hosts of p_place for 'host'. Centralises the query every queuing
-- site below needs for both notice recipients and invite attendees. Not
-- granted to authenticated — internal helper only, mirrors
-- app_private.fold_application's own "no grant" posture.
create function app_private.stayover_side_members(p_child uuid, p_place uuid, p_side text)
returns table (member_id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, (select lower(u.email) from auth.users u where u.id = m.user_id)
  from public.member m
  where m.status = 'active'
    and (
      (p_side = 'parent' and m.id in (select g.member_id from public.guardian g where g.child_id = p_child))
      or (p_side = 'host' and m.id in (select ph.member_id from public.place_host ph where ph.place_id = p_place))
    );
$$;

revoke execute on function app_private.stayover_side_members(uuid, uuid, text) from public;

-- app_private.stayover_participants (helper, this migration only) ----------
-- Every active participant of an application (both sides) — invite
-- attendees (ARCHITECTURE.md §8 `participants`, rule 7).
create function app_private.stayover_participants(p_child uuid, p_place uuid)
returns table (member_id uuid, email text, side text)
language sql
stable
security definer
set search_path = ''
as $$
  select member_id, email, 'parent'::text from app_private.stayover_side_members(p_child, p_place, 'parent')
  union all
  select member_id, email, 'host'::text from app_private.stayover_side_members(p_child, p_place, 'host');
$$;

revoke execute on function app_private.stayover_participants(uuid, uuid) from public;

-- app_private.queue_notice (helper, this migration only) --------------------
-- Inserts one 'notice' dispatch row per active member on p_side, with the
-- given payload. Returns nothing — callers don't need the ids (unlike
-- claim_pending_dispatches, nothing downstream needs "which rows are mine"
-- for this insert-only path).
create function app_private.queue_notice(
  p_application uuid, p_child uuid, p_place uuid, p_side text, p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.dispatch (member_id, application_id, to_email, kind, revision, payload)
  select member_id, p_application, email, 'notice', 0, p_payload
  from app_private.stayover_side_members(p_child, p_place, p_side);
end;
$$;

revoke execute on function app_private.queue_notice(uuid, uuid, uuid, text, jsonb) from public;

-- app_private.queue_invite (helper, this migration only) --------------------
-- Inserts one 'invite' dispatch row per active participant (both sides).
-- p_payload should already carry the attendee email list (built by the
-- caller from stayover_participants) so every recipient's row is
-- self-rendering without a further read.
create function app_private.queue_invite(
  p_application uuid, p_child uuid, p_place uuid, p_revision int, p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.dispatch (member_id, application_id, to_email, kind, revision, payload)
  select member_id, p_application, email, 'invite', p_revision, p_payload
  from app_private.stayover_participants(p_child, p_place);
end;
$$;

revoke execute on function app_private.queue_invite(uuid, uuid, uuid, int, jsonb) from public;

-- public.record_move (replaces 20260924000900_stays_functions.sql's — every
-- existing statement unchanged; dispatch queuing appended before the final
-- `return query`, using v_fold (before) / v_fold_after (after) and the
-- values already computed above) ---------------------------------------
create or replace function public.record_move(
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
  v_fold_after record;
  v_note text;
  v_move_id uuid;
  v_by uuid;
  v_at timestamptz;
  v_date_start date;
  v_date_end date;
  v_status_after text;
  v_capacity int;
  v_conflict record;
  v_child_name text;
  v_place_name text;
  v_place_address text;
  v_place_tz text;
  v_by_name text;
  v_notify_side text;
  v_issue_invite boolean := false;
  v_invite_method text;
  v_attendees jsonb;
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

  select * into v_fold_after from app_private.fold_application(p_application);
  v_status_after := v_fold_after.status;

  -- Dispatch queuing (design.md Decision a, d; ARCHITECTURE.md §5's
  -- planDelivery table) — appended after the domain write above; never
  -- changes what record_move returns or how it fails.
  select c.name, p.name, p.address, p.time_zone
  into v_child_name, v_place_name, v_place_address, v_place_tz
  from public.child c, public.place p
  where c.id = v_child and p.id = v_place;

  select m.name into v_by_name from public.member m where m.id = v_member_id;

  if p_kind = 'propose' then
    -- Notify the side now awaited (covers both "no agreement yet" and
    -- "change on a confirmed stay" — same notice either way per §5).
    v_notify_side := v_fold_after.awaiting;
  elsif p_kind = 'accept' then
    -- Notify the side that made the now-accepted proposal.
    v_notify_side := v_fold.open_side;
    v_issue_invite := true;
    v_invite_method := 'REQUEST';
  elsif p_kind = 'reject' then
    v_notify_side := v_fold.open_side;
  elsif p_kind = 'cancel' then
    v_notify_side := case v_side when 'parent' then 'host' else 'parent' end;
    if v_fold.agreed_start is not null then
      v_issue_invite := true;
      v_invite_method := 'CANCEL';
    end if;
  end if;

  if v_notify_side is not null then
    perform app_private.queue_notice(
      p_application, v_child, v_place, v_notify_side,
      jsonb_build_object(
        'notice_kind', p_kind,
        'child_name', v_child_name,
        'place_name', v_place_name,
        'mover_name', v_by_name,
        'mover_side', v_side,
        'note', v_note,
        'date_start', coalesce(v_date_start, v_fold_after.agreed_start),
        'date_end', coalesce(v_date_end, v_fold_after.agreed_end),
        'application_id', p_application
      )
    );
  end if;

  if v_issue_invite then
    select coalesce(jsonb_agg(email), '[]'::jsonb) into v_attendees
    from app_private.stayover_participants(v_child, v_place);

    perform app_private.queue_invite(
      p_application, v_child, v_place, v_fold_after.revision,
      jsonb_build_object(
        'method', v_invite_method,
        'application_id', p_application,
        'revision', v_fold_after.revision,
        'child_name', v_child_name,
        'place_name', v_place_name,
        'place_address', v_place_address,
        'time_zone', v_place_tz,
        'date_start', v_fold_after.agreed_start,
        'date_end', v_fold_after.agreed_end,
        'attendees', v_attendees
      )
    );
  end if;

  return query
  select
    v_move_id, p_application, v_child, v_place, p_kind, v_side, v_by, v_at,
    v_date_start, v_date_end, v_note, v_fold.status, v_status_after;
end;
$$;

revoke execute on function public.record_move(uuid, text, date, date, text) from public, anon;
grant execute on function public.record_move(uuid, text, date, date, text) to authenticated;

-- public.open_application (replaces 20260924000900_stays_functions.sql's —
-- every existing statement unchanged; dispatch queuing appended: this is
-- always a PROPOSE by the parents, so it always notifies the hosts) --------
create or replace function public.open_application(
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
  v_child_name text;
  v_place_name text;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = 'P0001', hint = 'You must be signed in.';
  end if;

  select id, role, status, name into v_member from public.member where user_id = v_uid;
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

  -- Dispatch queuing: the opening PROPOSE always notifies the hosts.
  select c.name, p.name into v_child_name, v_place_name
  from public.child c, public.place p
  where c.id = p_child and p.id = p_place;

  perform app_private.queue_notice(
    v_app_id, p_child, p_place, 'host',
    jsonb_build_object(
      'notice_kind', 'propose',
      'child_name', v_child_name,
      'place_name', v_place_name,
      'mover_name', v_member.name,
      'mover_side', 'parent',
      'note', v_note,
      'date_start', p_date_start,
      'date_end', p_date_end,
      'application_id', v_app_id
    )
  );

  return query
  select v_app_id, v_move_id, p_child, p_place, 'propose'::text, 'parent'::text, v_by, v_at,
         p_date_start, p_date_end, v_note, 'negotiating'::text;
end;
$$;

revoke execute on function public.open_application(uuid, uuid, date, date, text) from public, anon;
grant execute on function public.open_application(uuid, uuid, date, date, text) to authenticated;

-- public.delete_application (replaces 20260924000900_stays_functions.sql's —
-- every existing statement unchanged; dispatch queuing inserted BEFORE the
-- delete statements, referencing p_application while the row still exists —
-- `dispatch.application_id references application (id) on delete set null`
-- then nulls it automatically once the row below is deleted, matching §4
-- `d_application?` "undefined after a hard delete") ------------------------
create or replace function public.delete_application(p_application uuid)
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

  -- Dispatch queuing (spec "A withdrawn request notifies the hosts") —
  -- inserted here, before the application row is deleted below, so the FK's
  -- own `on delete set null` is what clears application_id afterwards.
  perform app_private.queue_notice(
    p_application, v_child, v_place, 'host',
    jsonb_build_object(
      'notice_kind', 'withdrawn',
      'child_name', v_child_name,
      'place_name', v_place_name,
      'date_start', coalesce(v_fold.agreed_start, v_fold.open_start),
      'date_end', coalesce(v_fold.agreed_end, v_fold.open_end),
      'application_id', p_application
    )
  );

  delete from public.move where application_id = p_application;
  delete from public.application where id = p_application;

  return query
  select v_child_name, v_place_name, v_hosts, v_fold.agreed_start, v_fold.agreed_end, v_fold.open_start, v_fold.open_end;
end;
$$;

revoke execute on function public.delete_application(uuid) from public, anon;
grant execute on function public.delete_application(uuid) to authenticated;

-- public.register (replaces 20260924000300_foundation_functions.sql's —
-- every existing statement unchanged; dispatch queuing appended exactly when
-- v_status = 'waiting' — design.md Decision d) -----------------------------
create or replace function public.register(p_role text, p_name text, p_code text default null)
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

  -- Dispatch queuing (design.md Decision d): fires once, exactly when the
  -- outcome is 'waiting' — never for 'active', never for 'wrong_code'
  -- (handled above by its own early `return`, before any member row or
  -- dispatch row exists). Recipients are every app_admin email, member_id
  -- null (ARCHITECTURE.md §4 "no Member row exists for the admin").
  if v_status = 'waiting' then
    insert into public.dispatch (member_id, application_id, to_email, kind, revision, payload)
    select null, null, a.email, 'notice', 0,
      jsonb_build_object('notice_kind', 'waiting', 'person_name', v_name, 'role', p_role)
    from public.app_admin a;
  end if;

  return query select v_status, v_member_id, greatest(0, 5 - v_wrong_count);
end;
$$;

revoke execute on function public.register(text, text, text) from public, anon;
grant execute on function public.register(text, text, text) to authenticated;

-- public.dispatch_is_superseded (design.md Decision 3, tasks.md 4.2's
-- remaining isSuperseded; ARCHITECTURE.md §6 rule 3 "dropped if a newer
-- revision has already been dispatched") -----------------------------------
-- Worker-secret-gated (same reasoning as claim_pending_dispatches/
-- record_dispatch_outcome in 20260924001100_delivery_outbox.sql: without the
-- secret, any signed-in identity could probe which applications have a sent
-- invite at a given revision). True iff a 'sent' invite for the same
-- application already carries a strictly higher revision than p_revision.
create function public.dispatch_is_superseded(p_secret text, p_application uuid, p_revision int)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app_private.check_worker_secret(p_secret);

  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = 'P0001', hint = 'You must be signed in.';
  end if;

  return exists (
    select 1 from public.dispatch d
    where d.application_id = p_application
      and d.kind = 'invite'
      and d.status = 'sent'
      and d.revision > p_revision
  );
end;
$$;

revoke execute on function public.dispatch_is_superseded(text, uuid, int) from public, anon;
grant execute on function public.dispatch_is_superseded(text, uuid, int) to authenticated;

-- public.admin_failed_dispatches (design.md Decision 4; tasks.md 5.1) ------
-- Admin-only; no SMTP config or credentials in the projection, just what the
-- spec's "Admin views failed deliveries" scenario asks for.
create function public.admin_failed_dispatches(p_limit int default 50)
returns table (id uuid, kind text, to_email text, last_error text, updated_at timestamptz)
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
    raise exception 'not_admin' using errcode = 'P0001', hint = 'Only the admin can view failed deliveries.';
  end if;

  return query
  select d.id, d.kind, d.to_email, d.last_error, d.updated_at
  from public.dispatch d
  where d.status = 'failed'
  order by d.updated_at desc
  limit greatest(1, coalesce(p_limit, 50));
end;
$$;

revoke execute on function public.admin_failed_dispatches(int) from public, anon;
grant execute on function public.admin_failed_dispatches(int) to authenticated;

-- public.application_dispatch_summary (tasks.md 5.2; ui-design-brief.md §5
-- "Stage 4" quiet delivery-status line) --------------------------------
-- Participant-of-the-application-only (or admin); a coarse rollup, never the
-- recipient list or any error text beyond one representative failed
-- recipient's display name (never their email) — enough for "Calendar
-- invites sent to N of M people" / "Couldn't send to {name} — we'll stop
-- retrying after 3 attempts", nothing more.
create function public.application_dispatch_summary(p_application uuid)
returns table (sent int, total int, failed_recipient_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_child uuid;
  v_place uuid;
  v_authorized boolean;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = 'P0001', hint = 'You must be signed in.';
  end if;

  select a.child_id, a.place_id into v_child, v_place from public.application a where a.id = p_application;
  if not found then
    raise exception 'not_found' using errcode = 'P0001', hint = 'No such application.';
  end if;

  v_authorized := app_private.is_admin()
    or v_child in (select app_private.my_child_ids())
    or v_place in (select app_private.my_place_ids());
  if not v_authorized then
    raise exception 'not_participant' using errcode = 'P0001',
      hint = 'Only this application''s parents or hosts can see its delivery status.';
  end if;

  return query
  select
    count(*) filter (where d.status = 'sent')::int,
    count(*)::int,
    (
      select m.name from public.dispatch fd
      left join public.member m on m.id = fd.member_id
      where fd.application_id = p_application and fd.status = 'failed'
      order by fd.updated_at desc
      limit 1
    )
  from public.dispatch d
  where d.application_id = p_application;
end;
$$;

revoke execute on function public.application_dispatch_summary(uuid) from public, anon;
grant execute on function public.application_dispatch_summary(uuid) to authenticated;

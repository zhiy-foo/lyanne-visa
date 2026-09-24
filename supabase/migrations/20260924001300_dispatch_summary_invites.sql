-- public.application_dispatch_summary (replaces
-- 20260924001200_delivery_queue.sql's — same signature, return shape,
-- authorization and error codes; the UI labels this line "Calendar invite(s)
-- sent to N of M people" (ApplicationDetail.tsx), so it must count only
-- 'invite' dispatches, not notices too. It must also only count the
-- application's LATEST invite revision — record_move queues a fresh set of
-- invite rows (a new revision) on every accept, including a re-accept after
-- a date change (design.md's revision scheme, ARCHITECTURE.md §6 rule 3), so
-- counting every revision would inflate "of N" with rows from a superseded
-- revision. `failed_recipient_name` is unchanged: a failed notice is still
-- worth surfacing even though it no longer contributes to sent/total, so it
-- keeps searching across every kind, not just invite.) -----------------------
create or replace function public.application_dispatch_summary(p_application uuid)
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
  v_latest_invite_revision int;
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

  select max(d.revision) into v_latest_invite_revision
  from public.dispatch d
  where d.application_id = p_application and d.kind = 'invite';

  return query
  select
    count(*) filter (
      where d.kind = 'invite' and d.revision = v_latest_invite_revision and d.status = 'sent'
    )::int,
    count(*) filter (
      where d.kind = 'invite' and d.revision = v_latest_invite_revision
    )::int,
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

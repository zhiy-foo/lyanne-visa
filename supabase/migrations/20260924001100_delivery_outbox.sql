-- Delivery outbox: `dispatch` (design.md Decision 1) and the two functions
-- that claim/record against it (design.md Decision a, 2; tasks.md 1.1, 1.2).
-- Conventions match 20260924000900_stays_functions.sql: schema public
-- (Supabase RPC), `security definer set search_path = ''`, every name
-- schema-qualified, closed-list P0001 codes with a hint, explicit
-- `revoke ... from public, anon;` then `grant ... to authenticated;`, every
-- UPDATE/DELETE has a WHERE clause (hosted Supabase runs pg-safeupdate).
--
-- Unlike every other table in this project, `dispatch` gets NO grant to
-- `authenticated` at all — not even SELECT (design.md Decision 1: "authenticated
-- gets no direct grant on the table at all, matching foundation's 'tables
-- read-only, or here not even that' posture"). The `SECURITY DEFINER`
-- functions below are the only path in or out. RLS is enabled anyway, with no
-- policies, as defence in depth: if a future migration ever grants a
-- privilege on this table by mistake, RLS still denies every row until a
-- policy is added deliberately.
--
-- `dispatch` rows are inserted only by the SECURITY DEFINER functions that
-- write Stayover's/foundation's domain changes (tasks.md 2.1, 2.2 — a later
-- pass, not this migration); this migration only creates the table and the
-- claim/record functions that later pass wires up.

create table dispatch (
  id uuid primary key default gen_random_uuid(),
  member_id uuid null references member (id),
  application_id uuid null references application (id) on delete set null,
  to_email text not null check (to_email = lower(to_email) and length(to_email) > 0),
  kind text not null check (kind in ('notice', 'invite')),
  revision int not null default 0 check (revision >= 0),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts int not null default 0 check (attempts >= 0 and attempts <= 4),
  last_error text null,
  claimed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Bounded retry (proposal.md, ARCHITECTURE.md §4 `d_attempts`): terminal
  -- `failed` only ever lands at the 4th attempt; `sent` needs no particular
  -- attempts count (it can succeed on the first try).
  constraint dispatch_failed_at_fourth_attempt check (status <> 'failed' or attempts = 4),
  -- `last_error` is defined iff `FAILED` (ARCHITECTURE.md §4 `d_error?`).
  constraint dispatch_error_iff_failed check ((status = 'failed') = (last_error is not null))
);

alter table dispatch enable row level security;
-- No SELECT/INSERT/UPDATE/DELETE policy is created — every access goes
-- through the SECURITY DEFINER functions below, which run as their
-- definer (bypassing RLS the same way every other function in this project
-- does) rather than as the calling role.

-- Speeds up claim_pending_dispatches' scan (pending rows, oldest first) and
-- the superseded-invite check a later pass (task 4.2) makes per application.
create index dispatch_pending_idx on dispatch (status, created_at);
create index dispatch_application_idx on dispatch (application_id) where application_id is not null;

comment on table dispatch is
  'Delivery audit/outbox (design.md Decision 1). Insert-only from the
   SECURITY DEFINER functions that also write the domain change it reports
   on; status/attempts/claimed_at/last_error change only through
   claim_pending_dispatches/record_dispatch_outcome below.';

-- app_private.dispatch_backoff (design Decision 2) ---------------------------
-- Pure function of a row's own `attempts`/`updated_at`: how long after the
-- last attempt a pending-but-already-attempted row waits before it is
-- eligible to be claimed again. Growing linearly with `attempts` ("backoff
-- ... growing with each attempt", design.md Decision 2); a row that has never
-- been attempted (`attempts = 0`) has no wait at all. Not granted to
-- authenticated — it is an internal helper for claim_pending_dispatches only.
create function app_private.dispatch_backoff(p_attempts int)
returns interval
language sql
immutable
set search_path = ''
as $$
  select (p_attempts * interval '2 minutes');
$$;

revoke execute on function app_private.dispatch_backoff(int) from public;

-- app_private.delivery_worker / check_worker_secret (security fix) ----------
-- `auth.uid() is not null` alone lets ANY signed-in Google identity — even
-- one with no `member` row, or a waiting/deactivated one — call
-- claim_pending_dispatches/record_dispatch_outcome over the publishable-key
-- RPC surface: read every queued recipient's to_email, claim rows to delay
-- delivery, or mark any dispatch 'sent' to suppress it. The app has no
-- service-role key (design.md, "no service-role/secret Supabase key by
-- design"), so this cannot be fixed by having the server call these
-- functions as a privileged role; instead both functions now additionally
-- require a worker secret only the trusted retry caller (the app's own
-- server-side code, later pass) knows — a shared-secret check layered on top
-- of, not instead of, the existing auth.uid() requirement.
--
-- The secret itself is never stored in the repo or in this migration: the
-- owner generates one and inserts its hash once via the Supabase SQL editor
-- (docs/stayover/general/setup.md documents the exact step). Singleton table
-- (`id boolean primary key default true check (id)`, same pattern as
-- public.app_setting) — a second insert fails on the primary key, so there
-- is only ever one row, or none if no secret has been configured yet.
create table app_private.delivery_worker (
  id boolean primary key default true check (id),
  secret_hash text not null
);

alter table app_private.delivery_worker enable row level security;
-- No grant to anon/authenticated at all — not even the `usage on schema
-- app_private to authenticated` grant (foundation_visibility.sql) implies
-- table access; only app_private.check_worker_secret below, itself never
-- granted to authenticated either, reads this table, and only while running
-- as a SECURITY DEFINER function's definer.

comment on table app_private.delivery_worker is
  'Singleton holding a sha256 hash (hex-encoded) of the delivery worker
   secret. Never insert or update the plaintext secret anywhere — only its
   hash. See docs/stayover/general/setup.md for the one-time setup/rotation
   steps run by hand in the Supabase SQL editor.';

-- Raises 'not_worker' unless a secret has been configured AND p_secret's
-- sha256 hash (hex-encoded) matches it. Plain equality of the two hashes,
-- not a constant-time comparison — plpgsql has no constant-time compare
-- primitive available here, so a timing side-channel against this check is a
-- known, accepted residual risk (the secret is long/random and this is not a
-- password-guessing surface an attacker can practically iterate against over
-- Supabase's own RPC latency, unlike e.g. a login form). Internal helper: no
-- grant to authenticated, so it can only run inside another SECURITY
-- DEFINER function's body (which executes as the function's definer/owner,
-- not the calling role).
create function app_private.check_worker_secret(p_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
begin
  select secret_hash into v_hash from app_private.delivery_worker where id = true;

  if v_hash is null
     or p_secret is null
     or encode(extensions.digest(p_secret, 'sha256'), 'hex') <> v_hash then
    raise exception 'not_worker' using errcode = 'P0001', hint = 'Delivery worker not authorised.';
  end if;
end;
$$;

revoke execute on function app_private.check_worker_secret(text) from public;

-- public.claim_pending_dispatches (design Decision a, 2; tasks.md 1.2) -------
-- Claims up to p_limit dispatch rows that are either untouched, past their
-- own backoff window since the last failed attempt, or stuck mid-attempt
-- (claimed more than p_stale_after ago and never resolved — design.md
-- Decision b step 4, "a cut-short attempt is picked up again"). `for update
-- skip locked` lets two concurrent callers split a batch between them rather
-- than block or double-claim (verified as far as PGlite's single connection
-- allows — see test/db/delivery-outbox.test.ts's header comment; true
-- concurrent-claim locking is deferred to hosted Supabase, the same posture
-- as stays-functions.test.ts's overlap/capacity locks).
--
-- Requires the caller to be signed in AND to present the worker secret
-- (security fix above) — the claim is still not per-caller among trusted
-- callers (design.md Decision a: "the claim is not per-caller — any
-- signed-in request may trigger a retry batch"), but "trusted callers" now
-- means only the app's own retry code, which knows the secret, not any
-- signed-in identity.
create function public.claim_pending_dispatches(p_secret text, p_limit int default 20, p_stale_after interval default interval '5 minutes')
returns setof dispatch
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app_private.check_worker_secret(p_secret);

  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = 'P0001', hint = 'You must be signed in.';
  end if;

  if p_limit is null or p_limit < 1 then
    raise exception 'invalid_limit' using errcode = 'P0001', hint = 'Limit must be at least 1.';
  end if;

  if p_stale_after is null then
    raise exception 'invalid_stale_after' using errcode = 'P0001', hint = 'stale_after must be given.';
  end if;

  return query
  update public.dispatch d
  set claimed_at = now(), updated_at = now()
  where d.id in (
    select c.id
    from public.dispatch c
    where c.status = 'pending'
      and (
        -- Never claimed, or its own attempt failed and its backoff has
        -- elapsed since the last attempt.
        (c.claimed_at is null and now() - c.updated_at >= app_private.dispatch_backoff(c.attempts))
        -- Claimed but never resolved (process died mid-send) for longer
        -- than the stale window — re-claimable regardless of backoff.
        or (c.claimed_at is not null and now() - c.claimed_at >= p_stale_after)
      )
    order by c.created_at
    limit p_limit
    for update skip locked
  )
  returning d.*;
end;
$$;

revoke execute on function public.claim_pending_dispatches(text, int, interval) from public, anon;
grant execute on function public.claim_pending_dispatches(text, int, interval) to authenticated;

-- public.record_dispatch_outcome (design Decision a, 2; tasks.md 1.2) -------
-- Records the outcome of one attempt: 'sent' resolves the row for good;
-- 'failed' increments attempts and only becomes the terminal 'failed' status
-- once the 4th attempt has failed (spec "Bounded retry, then a recorded
-- failure") — otherwise the row goes back to 'pending' (claimed_at cleared)
-- so a later claim can retry it, honouring dispatch_backoff above. Idempotent
-- against a row that is already terminal (sent/failed): returns it unchanged
-- rather than raising, so a cut-short/duplicate call from the caller cannot
-- corrupt an already-resolved row.
--
-- Requires the worker secret (security fix above) in addition to auth.uid(),
-- same reasoning as claim_pending_dispatches: without it any signed-in
-- identity could mark any dispatch 'sent' to silently suppress delivery.
create function public.record_dispatch_outcome(p_secret text, p_dispatch_id uuid, p_status text, p_error text default null)
returns dispatch
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.dispatch;
  v_attempts int;
  v_final_status text;
  v_error text;
begin
  perform app_private.check_worker_secret(p_secret);

  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = 'P0001', hint = 'You must be signed in.';
  end if;

  if p_status is null or p_status not in ('sent', 'failed') then
    raise exception 'invalid_status' using errcode = 'P0001', hint = 'Status must be sent or failed.';
  end if;

  select * into v_row from public.dispatch where id = p_dispatch_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001', hint = 'No such dispatch.';
  end if;

  if v_row.status in ('sent', 'failed') then
    -- Already terminal (e.g. a stray duplicate call after a cut-short
    -- invocation resumed) — no-op, return the row as it already stands.
    return v_row;
  end if;

  v_attempts := v_row.attempts + 1;

  if p_status = 'sent' then
    v_final_status := 'sent';
    v_error := null;
  else
    v_error := nullif(btrim(coalesce(p_error, '')), '');
    v_final_status := case when v_attempts >= 4 then 'failed' else 'pending' end;
  end if;

  update public.dispatch
  set
    attempts = v_attempts,
    status = v_final_status,
    last_error = case when v_final_status = 'failed' then coalesce(v_error, 'unknown_error') else null end,
    claimed_at = case when v_final_status = 'pending' then null else claimed_at end,
    updated_at = now()
  where id = p_dispatch_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.record_dispatch_outcome(text, uuid, text, text) from public, anon;
grant execute on function public.record_dispatch_outcome(text, uuid, text, text) to authenticated;

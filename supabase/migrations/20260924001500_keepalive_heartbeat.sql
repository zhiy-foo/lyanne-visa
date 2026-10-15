-- keepalive-heartbeat: a real database write for the daily Vercel Cron
-- keepalive, so Supabase counts it as project activity. The app holds no
-- Supabase secret key, so the write goes through a password-locked function
-- the publishable-key (anon) role may execute: it only does anything when
-- handed the token whose SHA-256 the owner stored in token_sha256.

create table public.keepalive_heartbeat (
  id smallint primary key default 1 check (id = 1),
  last_ping_at timestamptz null,
  previous_ping_at timestamptz null,
  ping_count bigint not null default 0,
  token_sha256 text null
);

alter table public.keepalive_heartbeat enable row level security;
revoke all on table public.keepalive_heartbeat from anon, authenticated;

insert into public.keepalive_heartbeat (id) values (1);

create function public.keepalive_ping(token text)
returns table (last_ping_at timestamptz, previous_ping_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stored text;
begin
  select h.token_sha256 into v_stored
  from public.keepalive_heartbeat h
  where h.id = 1;

  -- Refuse (writing nothing) on an unset hash, a null/empty token or a mismatch.
  -- The message deliberately never includes the token.
  if v_stored is null
     or token is null
     or token = ''
     or encode(sha256(convert_to(token, 'UTF8')), 'hex') <> v_stored then
    raise exception 'keepalive_ping: not authorised' using errcode = '28000';
  end if;

  -- One atomic update: every right-hand side sees the old row, so
  -- previous_ping_at receives the prior last_ping_at without a race.
  return query
  update public.keepalive_heartbeat as h
  set previous_ping_at = h.last_ping_at,
      last_ping_at = now(),
      ping_count = h.ping_count + 1
  where h.id = 1
  returning h.last_ping_at, h.previous_ping_at;
end;
$$;

revoke execute on function public.keepalive_ping(text) from public, anon, authenticated;
grant execute on function public.keepalive_ping(text) to anon;

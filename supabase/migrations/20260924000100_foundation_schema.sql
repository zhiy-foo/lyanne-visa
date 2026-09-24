-- Foundation schema: accounts, children and places (docs/stayover/ARCHITECTURE.md §4).
-- Tables mirror the olog (design.md Decision 2). Email is deduced from
-- auth.users, never copied, so there is no email column on `member`.

-- Supabase installs pgcrypto into the `extensions` schema, not `public`; this
-- is a no-op there, but keeps local (PGlite) and hosted behaviour identical.
-- Every use below is fully schema-qualified: `extensions.crypt(...)`,
-- `extensions.gen_salt(...)`.
create extension if not exists pgcrypto with schema extensions;

-- member ---------------------------------------------------------------

create table member (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 80),
  role text not null check (role in ('parent', 'host')),
  status text not null check (status in ('waiting', 'active', 'deactivated')),
  status_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table member enable row level security;

-- child ------------------------------------------------------------------

create table child (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  created_by uuid not null references member (id),
  created_at timestamptz not null default now()
);

alter table child enable row level security;

-- place --------------------------------------------------------------------

create table place (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  address text null check (address is null or length(address) <= 300),
  time_zone text not null,
  created_by uuid not null references member (id),
  created_at timestamptz not null default now()
);

alter table place enable row level security;

-- guardian / place_host spans ------------------------------------------------

create table guardian (
  member_id uuid not null references member (id),
  child_id uuid not null references child (id) on delete cascade,
  primary key (member_id, child_id)
);

alter table guardian enable row level security;

-- Speeds up "guardians of this child" lookups (remove_guardian's last-parent
-- count, admin_set_guardian, member_select's co-guardian join).
create index guardian_child_id_idx on guardian (child_id);

create table place_host (
  member_id uuid not null references member (id),
  place_id uuid not null references place (id) on delete cascade,
  primary key (member_id, place_id)
);

alter table place_host enable row level security;

-- Speeds up "hosts of this place" lookups (remove_host's last-host count,
-- admin_set_host, member_select's co-host join).
create index place_host_place_id_idx on place_host (place_id);

-- deployment configuration (not family data) --------------------------------

create table app_admin (
  email text primary key check (email = lower(email))
);

alter table app_admin enable row level security;

create table app_setting (
  id boolean primary key default true check (id),
  join_code_hash text
);

alter table app_setting enable row level security;

insert into app_setting (id, join_code_hash) values (true, null);

create table join_attempt (
  user_id uuid primary key references auth.users (id),
  wrong_count int not null default 0 check (wrong_count >= 0)
);

alter table join_attempt enable row level security;

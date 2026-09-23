-- Foundation schema: accounts, children and places (docs/stayover/ARCHITECTURE.md §4).
-- Tables mirror the olog (design.md Decision 2). Email is deduced from
-- auth.users, never copied, so there is no email column on `member`.

create extension if not exists pgcrypto;

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

create table place_host (
  member_id uuid not null references member (id),
  place_id uuid not null references place (id) on delete cascade,
  primary key (member_id, place_id)
);

alter table place_host enable row level security;

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

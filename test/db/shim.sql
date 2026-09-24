-- Minimal Supabase-compatible shim for PGlite integration tests.
-- Provides the roles, auth schema and helper functions that RLS policies and
-- SECURITY DEFINER functions rely on when running against real Supabase.
-- Keep this file minimal: it exists to let migrations written for Supabase
-- run unchanged, not to reimplement Supabase.

-- Roles ----------------------------------------------------------------

do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  else
    alter role service_role bypassrls;
  end if;
end
$$;

-- auth schema ------------------------------------------------------------

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text not null
);

-- auth.uid(): the authenticated user's id, from the request.jwt.claims
-- setting; null when unset or unparsable (mirrors Supabase's null-safe
-- behaviour for anonymous/service-role callers).
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub')::uuid;
$$;

-- auth.jwt(): the full claims object, or an empty object when unset.
create or replace function auth.jwt()
returns json
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::json, '{}'::json);
$$;

-- extensions schema --------------------------------------------------------

-- Real Supabase installs pgcrypto (and other extensions) into a dedicated
-- `extensions` schema, not `public`; migrations must reference it explicitly
-- (`extensions.crypt`, `extensions.gen_salt`) for this shim and the hosted
-- project to agree.
create schema if not exists extensions;

-- Grants -------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;

-- Real Supabase grants ALL on every table/sequence/function created in
-- `public` to anon, authenticated and service_role by default (and EXECUTE on
-- new functions to PUBLIC), so a forgotten `revoke` in a migration would pass
-- tests here and still leak in production. Mirror that permissiveness as the
-- baseline; migrations are then responsible for locking it down explicitly
-- (see the foundation visibility migration).
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to public;

-- auth.users must not be directly selectable by anon/authenticated, matching
-- real Supabase (where only Supabase Auth and service_role can read it).
revoke all on auth.users from anon, authenticated;
grant all on auth.users to service_role;

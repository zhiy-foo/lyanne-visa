-- Stays schema: `application` and `move` (design.md Decision 1), plus
-- `place.capacity` (design.md §3 consolidation check — a scalar fact on
-- `Place`, not a new table). Tables are read-only to app roles; every write
-- goes through a SECURITY DEFINER function in the next migration, mirroring
-- foundation's convention (20260924000100_foundation_schema.sql).
--
-- Task 1.2 deviation (orchestrator correction, tasks.md left unticked):
-- design.md and tasks.md 1.2 call for a tstzrange/date-range exclusion
-- constraint on agreed ranges per child as defence in depth for rule 6. That
-- is NOT added here: `agreed?` is deduced by folding `move` (design Decision
-- 2), never stored as a column, so there is no column an exclusion
-- constraint could index — a constraint needs a stored span to compare, and
-- none exists. Concurrency safety for rule 6 (no double-booking) and for
-- home capacity instead comes entirely from `record_move` (next migration)
-- taking `select ... for update` on the CHILD row (double-booking) and the
-- PLACE row (capacity) before checking — the same pattern foundation uses
-- for its last-parent/last-host counts. PGlite (the local/CI test database)
-- has exactly one connection, so a genuine concurrent-accept race cannot be
-- expressed as a PGlite test; that check is deferred to hosted Supabase
-- (see the comment in test/db/stays-functions.test.ts).

-- application ----------------------------------------------------------

create table application (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references child (id),
  place_id uuid not null references place (id),
  created_by uuid not null references member (id),
  created_at timestamptz not null default now()
);

alter table application enable row level security;

-- Speeds up "other applications for this child" (double-booking) and
-- "applications at this place" (capacity, host visibility) lookups.
create index application_child_id_idx on application (child_id);
create index application_place_id_idx on application (place_id);

-- move -------------------------------------------------------------------
-- Append-only negotiation log (design Decision 1, rule 5): no UPDATE/DELETE
-- grant is ever given to any app role. `seq` is a monotonic tie-breaker for
-- `at` (two moves can share a timestamp within one transaction/test run);
-- `fold_application` orders by `seq`, not `at` alone, so the fold is always
-- deterministic. `mv_dates?` defined iff `mv_kind = PROPOSE` (rule 2) is
-- enforced by the check constraint below, at the schema level, not just in
-- the writing function.

create table move (
  id uuid primary key default gen_random_uuid(),
  seq bigserial not null,
  application_id uuid not null references application (id),
  kind text not null check (kind in ('propose', 'accept', 'reject', 'cancel')),
  side text not null check (side in ('parent', 'host')),
  by uuid not null references member (id),
  at timestamptz not null default now(),
  date_start date null,
  date_end date null,
  note text null check (note is null or length(note) <= 2000),
  constraint move_dates_iff_propose check (
    (kind = 'propose') = (date_start is not null and date_end is not null)
  ),
  constraint move_date_order check (date_start is null or date_end is null or date_start < date_end)
);

alter table move enable row level security;

create index move_application_id_idx on move (application_id);
create unique index move_seq_idx on move (seq);

-- place.capacity (design Decision 5's "Optional home capacity") ------------

alter table place add column capacity int null check (capacity is null or capacity > 0);

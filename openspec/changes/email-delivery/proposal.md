# Proposal

## Why

Once `stays` lets a family negotiate and confirm a stay in the app, nobody is
told about it anywhere else: no email says it is someone's turn to answer, and no
calendar event exists for the grandparents, the parents, or anyone else to see
the dates. docs/delivery/ARCHITECTURE.md already models this as a separate
component reachable only through the `StayoverEvent` port `stays` emits
(dependency mediation, Law 4) — this change builds that component: turn notices,
update-in-place `.ics` calendar invites, an admin notice for new waiting
accounts, and the delivery audit and retry behind them.

## What Changes

- **`Dispatch`** — the delivery audit object (recipient, kind, revision,
  attempts, status, error) for every notice and invite ever sent or attempted.
- **Turn notices** — a plain email to whichever side's answer is now needed,
  triggered by a `MoveCommitted` event, per docs/delivery/ARCHITECTURE.md §5's
  event → notice/invite table.
- **Calendar invites (`.ics`)** — `METHOD:REQUEST` on a new agreement or an
  agreed-date change, `METHOD:CANCEL` after a confirmed stay is cancelled; a
  stable `ev_uid` per application and a `SEQUENCE` equal to `revision` so a
  recipient's calendar updates the same event in place rather than duplicating
  it; an all-day event over the agreed dates in the place's time zone; organizer
  = the app's Gmail address; attendees = the application's participants.
- **`ApplicationDeleted` notice** — tells the hosts a request was withdrawn.
- **`MemberWaiting` notice** — tells the admin a new account is waiting for
  approval.
- **Bounded retry** — one send plus up to three retries with backoff, then
  `FAILED` and never retried again; delivery never blocks or rolls back the
  Stayover write that triggered it.
- **`Mailer` port** with a Gmail SMTP adapter (the app's dedicated account) and a
  console/test double, matching docs/delivery/ARCHITECTURE.md §5 (YAGNI — one
  adapter today).
- **A small admin view of recent `FAILED` dispatches.**
- **Design answers (this change's design.md)** to how the server gets recipient
  emails without a service-role key, how "after the response" is realised given
  Vercel's Next.js runtime, which SMTP library and env vars, and when
  `MemberWaiting` notices fire.

Out of scope: any UI change to `stays`' screens beyond the one quiet delivery-
status line and the "add to contacts" tip already scoped to `stays`'
`ApplicationDetail` (ui-design-brief.md §5 "Stage 4"); those lines are added by
this change since they render `Dispatch` data, but the screens themselves belong
to `stays`.

## Capabilities

### New Capabilities

- `email-delivery`: the delivery plan, the dispatch audit, notices, calendar
  invites and their retry/failure behaviour, the `Mailer` port, and the admin
  failed-dispatch view.

### Modified Capabilities

None. This change is a pure consumer of the `stayover_event` port `stays`
defines; it adds new tables/functions of its own and does not change any
`stays` or `account-access`/`children-and-homes` requirement. (It does read
`MemberWaiting`, which foundation's `register` already conceptually emits per
ARCHITECTURE.md §8 but foundation's own change never built a consumer for —
this change adds that consumer without altering `register`'s existing
behaviour or spec.)

## Impact

- **New code**: `supabase/migrations/` (`dispatch` table, planning/claiming
  functions); `src/delivery/` (`planDelivery`, `buildEvent`, `renderIcs`,
  `renderNotice`, the `Mailer` port and its two adapters, `dispatch`/retry
  logic); a small `src/app/admin/dispatches/` (or similar) admin page.
- **New dependency**: an SMTP client library (named and justified in design.md).
- **New env vars** (server-only, never `NEXT_PUBLIC_`): SMTP credentials for the
  app's Gmail account, distinct from Supabase's own SMTP credentials (design.md
  answers whether they must differ).
- **Depends on**: `stays` (openspec/changes/stays/) for the `StayoverEvent` port,
  `participants` and `calendarFacts`; this change does not modify anything in
  `stays` and can be implemented once `stays` lands, or in parallel against its
  agreed port shape.

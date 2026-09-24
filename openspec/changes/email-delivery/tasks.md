# Tasks

## 1. Schema and outbox (design Decision a, 1)

- [ ] 1.1 Migration creating `dispatch` (design Decision 1: nullable `member_id`/`application_id`, `kind`, `revision`, `status`, `attempts`, `last_error`, `claimed_at`, timestamps), no direct grants to `authenticated`; verify `supabase db reset`/PGlite harness applies cleanly and a direct `SELECT`/`INSERT` by `authenticated` is refused
- [ ] 1.2 `claim_pending_dispatches(limit, stale_after interval)` and `record_dispatch_outcome(dispatch_id, status, error?)`, both `SECURITY DEFINER`, callable by any authenticated caller (the claim is not per-caller — any signed-in request may trigger a retry batch, per design Decision b step 3) but never exposing another member's email beyond what `dispatch.to_email` already stores; verify: claims only `pending` or stale-claimed rows, marks `claimed_at`, a second concurrent claim of the same row is refused/skipped (locking test), outcome recording increments `attempts` and sets `failed` only at the 4th failed attempt

## 2. Extend the writing functions to queue dispatches (design Decision a, d)

- [ ] 2.1 Extend `stays`' `record_move`, `open_application`, `delete_application` to insert the correct `dispatch` rows (per specs/email-delivery/spec.md's notice/invite rules) in the same transaction as the domain write, resolving each recipient's address the same way `member_emails`/`my_account` already do; verify a PGlite test per move outcome (propose/counter/accept/reject/cancel/delete) asserting the right `dispatch` rows (kind, recipients, revision) are queued, and that a refused move queues nothing
- [ ] 2.2 Extend foundation's `register` to insert a `MemberWaiting` `dispatch` row (design Decision d) exactly when the outcome is `'waiting'`; verify: waiting outcome queues one admin-addressed dispatch, active outcome queues none, wrong-code outcome (still no member created) queues none
- [ ] 2.3 Verify (integration) that none of 2.1/2.2's dispatch inserts can cause the triggering write to fail or roll back — a forced failure inside the dispatch insert (e.g. a temporarily broken constraint in a test) must not be reachable from normal inputs, and a passing test confirms the domain write's own refusal paths are unaffected by the new inserts

## 3. Pure delivery functions (design Decision 3)

- [ ] 3.1 `buildEvent(calendarFacts)` → `CalendarEvent` (uid, sequence, method, span, title, location?, organizer, attendees) per delivery ARCHITECTURE.md §4; verify unit tests for each deduced field, including `REQUEST` vs `CANCEL` selection and all-day span computed in the place's time zone
- [ ] 3.2 `renderIcs(CalendarEvent)` → RFC 5545 text; verify unit tests asserting required components (`VERSION`, `PRODID`, `METHOD`, one `VEVENT` with `UID`/`DTSTAMP`/`SEQUENCE`/`ORGANIZER`/`ATTENDEE*`/`SUMMARY`/`DTSTART`/`DTEND` as `VALUE=DATE`), correct half-open date handling (`DTEND` exclusive matching `dr_end`), and stability (same input ⟹ byte-identical `UID`/`SEQUENCE` across calls)
- [ ] 3.3 `renderNotice(StayoverEvent, Member)` → plain HTML+text email per ui-design-brief.md §6 (turn notice, and the withdrawn/waiting variants); verify snapshot-style tests for each notice kind and a check that every piece of information also appears as plain text (no images-off breakage)
- [ ] 3.4 `planDelivery(StayoverEvent)` → `PlannedDispatch*` per delivery ARCHITECTURE.md §5's table, used to double-check 2.1/2.2's SQL-side queuing matches the same plan in a pure, independently testable function; verify a table-driven unit test with one case per row of §5

## 4. Mailer port and dispatch loop (design Decisions b, c, 2)

- [ ] 4.1 `Mailer` port (`send(EmailMessage) → SendResult`) with a Gmail SMTP adapter using `nodemailer` (design Decision c: env vars `DELIVERY_SMTP_USER`, `DELIVERY_SMTP_APP_PASSWORD`, `DELIVERY_FROM_ADDRESS`, never `NEXT_PUBLIC_`) and a console/test double selected by config; verify a test that `src/delivery/` never imports the Gmail adapter's credentials outside that one adapter module, and that the console double is used in the test/dev environment by default
- [ ] 4.2 `sendPendingDispatches(batchSize)`: claims via 1.2, renders via 3.2/3.3, sends via 4.1, records the outcome via 1.2, backs off per design Decision 2, and skips (marks superseded/sent-as-no-op) a stale invite when a newer revision for the same application already shows `sent` (spec: "A stale retry is superseded"); verify: happy path sends and records `sent`; a forced `Mailer` failure increments attempts and eventually reaches `failed` at the 4th attempt; a superseded invite is not sent and does not consume an attempt against the newer revision's own row
- [ ] 4.3 Wire `after(() => sendPendingDispatches(ids))` (design Decision b step 2) into the `stays` server actions and `register`'s action, guarded so its absence/failure never affects the response already sent; verify a test that the server action's result does not wait on delivery completing
- [ ] 4.4 Add the traffic-triggered fallback trigger (design Decision b step 3) at the point foundation's session-refresh middleware (`src/proxy.ts`) already runs, throttled to at most one retry batch per some window per instance; verify a test that it calls `sendPendingDispatches` at most once within the throttle window across repeated requests

## 5. Admin view and UI touches

- [ ] 5.1 `admin_failed_dispatches()` (design Decision 4) and its admin-only page/section listing kind, recipient, last error; verify a non-admin request for the data is refused, and the admin sees no SMTP credentials in the response
- [ ] 5.2 Add the quiet delivery-status line and one-time "add to contacts" tip to `stays`' `ApplicationDetail`/`StaysHome` screens (ui-design-brief.md §5 "Stage 4"), reading `Dispatch` summary data only, no new screen; verify a `src/ui/` boundary test and gallery states: all sent, one recipient failed ("Couldn't send to Grandpa — we'll stop retrying after 3 attempts")

## 6. Verification and reconcile

- [ ] 6.1 Run the full suite, lint and build; verify every spec scenario in `specs/email-delivery/spec.md` has a matching test, including the "delivery never blocks the triggering action" and "nobody outside participants is emailed" boundary tests
- [ ] 6.2 Reconcile docs: add realised rows (`file:symbol`, state `built`) to `docs/delivery/IMPLEMENTATION.md` for every Trn in ARCHITECTURE.md §7; update `docs/delivery/STATUS.md` and `docs/architecture-map.md` §5 coherence checklist (the `delivery → stayover` dependency-mediation row now has real code to check against); record the resolved Open Question (Netlify `after()`/`waitUntil` behaviour, once observed against the deployed app) in STATUS.md; run the supercharge drift check and verify it reports 0 dead

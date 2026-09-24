# Design

## Context

See proposal.md for motivation. The intended model is
docs/delivery/ARCHITECTURE.md in full (`Dispatch`, `event?`/`ev_*` deduced
fields, `planDelivery`, `buildEvent`, `renderIcs`, `renderNotice`, `dispatch ⊸`,
the `Mailer` port, §6 composition rules 1–7, §8 ports). `stays`
(openspec/changes/stays/) defines the `StayoverEvent` port this component
consumes and the `participants`/`calendarFacts` deduced reads
(openspec/changes/stays/design.md Decision 7). Foundation's `register` already
has the shape `MemberWaiting` needs (`ARCHITECTURE.md` §8 names it, but no
change built it yet — this one does).

Constraint that shapes almost every decision below: the app has **no
service-role/secret Supabase key by design** (foundation design.md — every write
is a `SECURITY DEFINER` function, `authenticated` gets filtered `SELECT` only).
`auth.users` — where every recipient's email actually lives — is not readable by
`authenticated` at all except through the narrow `SECURITY DEFINER` reads
foundation already built (`my_account`, `member_emails`, `admin_accounts`). This
change must get recipient addresses without breaking that posture.

## Goals / Non-Goals

**Goals:**
- Every notice/invite scenario in specs/email-delivery/spec.md, built on the
  `StayoverEvent` port without ever reading `Move*` or recomputing status
  (Law 4).
- Recipient addresses obtained without a service-role key and without widening
  any existing RLS policy's blast radius.
- A correct, minimal RFC 5545 `.ics` that updates in place (stable `UID`,
  monotone `SEQUENCE`).
- Bounded retry that survives a cut-short serverless invocation without ever
  double-sending a stale revision.

**Non-Goals:**
- Direct calendar API sync (ARCHITECTURE.md §2 rules this out deliberately —
  YAGNI, one channel).
- A queue or scheduler service — retries are driven by the next relevant
  request, per §2 "keeps v1 on free tiers" (Decision 2 below).
- Editing `stays`' screens beyond the one status line already scoped to it in
  the proposal.

## Decisions

### a) Recipient emails without a service-role key — DB-side outbox, chosen

**Chosen: DB-side outbox.** The same `SECURITY DEFINER` functions that already
write `stays`' moves (`record_move`, `open_application`, `delete_application`)
and foundation's `register` are extended to also insert `dispatch` rows —
*inside the same transaction as the domain write* — with the recipient address
already resolved server-side from `auth.users` (which the function can read,
being `SECURITY DEFINER`, exactly like `member_emails`/`my_account` already do).
A `claim_pending_dispatches()` function then lets the calling app request
(running as the user whose action just committed) select and mark-in-progress
only the dispatch rows created by that same transaction/call — realised by
having `record_move` etc. return the ids of the dispatch rows they just
inserted, so the app never has to guess which rows are "mine"; `authenticated`
gets no direct `SELECT`/`UPDATE` on `dispatch` at all, every access goes through
functions.

**Alternative: a server-only secret key.** A `SUPABASE_SERVICE_ROLE_KEY`
(or a narrower custom role) held only in `AppServer` env config, used by a
background job to look up any application's participants and their emails
directly. Rejected: it reverses foundation's central decision that "every
privacy rule must hold in the database, not just the UI" (foundation design.md,
Context) by creating exactly one path — the service key — where that stops
being true; a bug or a leaked env var on that path bypasses every RLS policy in
the project at once, for every table, not just `dispatch`. It would also need
its own review of *which* queries a background job with that key is allowed to
run, effectively re-inventing the same "one write path" discipline foundation
already has, but for reads, and outside the request-scoped `auth.uid()` context
Law 1 relies on.

**Recommendation: DB-side outbox.** It costs one extra insert per triggering
function (small, already inside their transaction) and keeps the "no service
key" invariant intact end to end. The `dispatch` row itself stores `d_to`
(the resolved address) so nothing downstream — `renderNotice`, `renderIcs`,
`sendEmail` — needs to read `auth.users` again; the sensitive read happens
exactly once, at the moment of the write it is caused by, by the function that
was already trusted to make that write.

### b) Running delivery "after the response" — verified, with a fallback

Verified from `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`
(Next 16, installed in this repo): `after()` exists, is stable, and works in
Server Components, Server Functions (server actions), Route Handlers and Proxy.
Its `Duration` section states it "will run for the platform's default or
configured max duration of your route" and its Platform Support table lists
"Adapters: Platform-specific" — i.e. whether it fires reliably is a property of
the *deployment adapter's* `waitUntil` wiring (documented in the same file's
"Reference: supporting `after` for serverless platforms" section), not of
Next.js itself. **Vercel supports `after()` natively via `waitUntil`**; this will
be confirmed empirically with one real send after the first deployment (mirrors
foundation's own deferred hosted-Supabase smoke test).

**Fallback (adopted as the actual mechanism, `after()` used only as a
best-effort extra):**
1. The server action performs the domain write, gets back the dispatch ids the
   DB already queued (Decision a), and returns its normal result to the caller
   immediately — the Stayover response is never delayed waiting on mail
   (spec: "Delivery never blocks... the action that triggered it").
2. Before returning, it also calls `after(() => sendPendingDispatches(ids))` if
   `after` is available in the running Next.js version (it is, per above) —
   this is free to attempt and, when the platform's `waitUntil` is honoured, is
   the common case that sends promptly with no user-visible delay at all.
3. Independently of whether step 2 actually got to run to completion, every
   `dispatch` row starts life `PENDING`. **Nothing relies on step 2
   succeeding.** A pending dispatch is retried the next time *any* signed-in
   member's request reaches a small piece of middleware/layout-level logic
   (already present for foundation's session-refresh middleware,
   `src/proxy.ts`) that, at most once per some throttling window, calls
   `sendPendingDispatches()` for a small batch of the oldest pending/retry-due
   rows — i.e. ordinary traffic is the retry trigger, not a scheduler, which
   is exactly Decision 2 below and keeps this on free tiers.
4. If the function is cut short mid-send (platform kills the invocation before
   `after()`'s callback finishes), the `dispatch` row for that message is left
   however `sendPendingDispatches` last left it — `PENDING` if the row was
   never claimed, or `d_attempts` incremented without a terminal status if a
   send was in flight and the process died before recording the outcome.
   `claim_pending_dispatches()` (Decision a) treats "claimed more than N
   minutes ago, still not `SENT`/`FAILED`" the same as `PENDING` for
   re-claiming, so a cut-short attempt is picked up again by the next trigger
   (step 3) rather than stuck forever; it still counts as one of the four
   attempts (spec: bounded retry), so a pathological repeated cut-short still
   terminates at `FAILED`.

This means correctness never depends on `after()`/`waitUntil` support — it only
affects *how promptly* a mail goes out (immediately vs. on the next request),
never *whether* it eventually does (up to the bounded-retry limit).

### c) SMTP client and env vars

**Library: `nodemailer`.** It is the de facto standard Node SMTP client,
actively maintained, has zero-config Gmail SMTP + app-password support
(matching foundation's own use of Gmail SMTP for Supabase Auth's custom SMTP,
so the operational pattern — an app password on a dedicated Gmail account — is
already proven at this scale), and needs no service beyond outbound SMTP on
port 587, which fits "free tiers only". *Alternative:* a transactional email
API (Resend, Postmark, SES) — rejected for v1: adds a paid-tier risk or a new
external account beyond what proposal.md scopes, and ARCHITECTURE.md §5
already commits to Gmail SMTP specifically ("v1's adapter is Gmail SMTP from a
dedicated app account").

**Env vars** (server-only; never `NEXT_PUBLIC_`, per delivery ARCHITECTURE.md
§6 rule 6 "secrets stay server-side"): `DELIVERY_SMTP_USER`,
`DELIVERY_SMTP_APP_PASSWORD`, `DELIVERY_FROM_ADDRESS` (the organizer address
used on invites — normally equal to `DELIVERY_SMTP_USER`).

**Separate app password, recommended.** Use a **different** Gmail app password
for this app's own SMTP sending than the one Supabase Auth's custom SMTP
already uses (foundation design.md Decision 8), even if both point at the same
`lyanne.stayovers@gmail.com` account. Reasons: (1) Gmail app passwords are
individually revocable — rotating one (e.g. after a leak in `AppServer` config)
must not also break Supabase's sign-in emails, and vice versa; (2) the two
send paths have different failure/retry semantics (Supabase's is fire-and-
forget outside this app's control; this app's has its own bounded-retry
accounting) and mixing them under one credential makes a Gmail-side send-rate
or abuse flag harder to attribute to the right sender; (3) it costs nothing —
Google allows multiple app passwords per account.

### d) Timing of `MemberWaiting` notices

**Fires once, at registration, when no join code is provided or the code is
wrong/exhausted** — i.e. exactly when foundation's `register` sets
`m_status = 'waiting'` (foundation ARCHITECTURE.md rule 1; `register`'s own
logic in `supabase/migrations/..._foundation_functions.sql` already
distinguishes this from the `'active'` path). It does **not** fire again later
(e.g. when the admin actually opens the admin page, or repeatedly while the
account is still waiting) — one notice per waiting registration matches the
spec scenario ("registers... without the code" ⟹ notified) and the outcome
table in delivery ARCHITECTURE.md §5, which lists `MemberWaiting` as a single
row keyed on the registration event, not a recurring reminder. Realised by
`register` inserting the `dispatch` row itself in the same transaction as the
`waiting` insert (Decision a) — `register` already knows the outcome
(`'waiting'` vs `'active'`) at that point, so no new read is needed to decide
whether to queue the notice.

### 1. `dispatch` table and its lifecycle
`dispatch (id, member_id null, application_id null, to_email, kind check in
('notice','invite'), revision int not null default 0, status check in
('pending','sent','failed'), attempts int not null default 0, last_error null,
claimed_at null, created_at, updated_at)`. `member_id` null for admin notices
(no `Member` row exists for the admin — ARCHITECTURE.md §4 "the admin cannot
register"); `application_id` null after a hard delete (rule matches `stays`
rule 13) and for account notices. Insert-only from the triggering
`SECURITY DEFINER` functions (Decision a); updates (`status`, `attempts`,
`claimed_at`, `last_error`) happen only through `claim_pending_dispatches` /
`record_dispatch_outcome`, also `SECURITY DEFINER` — `authenticated` gets no
direct grant on the table at all, matching foundation's "tables read-only, or
here not even that" posture.

### 2. Retry is a fold over `dispatch.attempts`, triggered by traffic
No queue, no cron (ARCHITECTURE.md §2 "no queue, no scheduler"). A pending or
stale-claimed dispatch is only ever picked up when `sendPendingDispatches` runs
— from the `after()` best-effort path (Decision b step 2) or from the
traffic-triggered fallback (Decision b step 3). Backoff between the 4 attempts
is computed from `attempts` and `updated_at` (e.g. not eligible for re-claim
until some minutes have passed since the last attempt, growing with each
attempt) — a pure function of the row's own fields, needing no external timer.

### 3. `buildEvent`/`renderIcs` are pure functions over `calendarFacts`
Exactly per delivery ARCHITECTURE.md §4: `ev_uid = '<application id>@lyanne-visa'`
(stable), `ev_sequence = revision` (monotone — Decision 1's `dispatch.revision`
column records which revision each invite carried, so `dispatch` itself is the
record that lets rule 3 "drop a stale retry" be checked: skip sending if a
`dispatch` for the same application with a higher `revision` and status `sent`
already exists). All-day event (`DTSTART;VALUE=DATE` / `DTEND;VALUE=DATE`,
exclusive end per iCalendar's own half-open convention, matching `dr_end`
already being exclusive in `stays`) computed in `p_tz`. `METHOD:REQUEST` for an
active agreement, `METHOD:CANCEL` when `phase = CANCELLED`. Validated against
RFC 5545 essentials in tests (Decision — see tasks): `BEGIN/END:VCALENDAR`,
`VERSION:2.0`, `PRODID`, one `VEVENT` with `UID`, `DTSTAMP`, `SEQUENCE`,
`ORGANIZER`, `ATTENDEE` per participant, `SUMMARY`, `DTSTART`/`DTEND` as
`VALUE=DATE`, and `METHOD` at the calendar level (required for `REQUEST`/
`CANCEL` semantics per RFC 5546).

### 4. Admin failed-dispatch view
A `SECURITY DEFINER`, admin-only function `admin_failed_dispatches()`
projecting `kind`, `to_email` (already resolved, not re-derived), `last_error`,
`updated_at` — no SMTP config, no credentials, nothing beyond what the spec's
"Admin views failed deliveries" scenario asks for.

## Risks / Trade-offs

- [`after()` support on Vercel] → Decision b's fallback makes correctness
  independent of the answer; Vercel supports `after()` natively via `waitUntil`,
  to be confirmed with one real send after the first deployment.
- [Traffic-triggered retry means a dispatch can sit `PENDING` indefinitely if
  nobody visits the app] → acceptable at family scale (someone opens the app
  within the retry window in virtually every real case); the admin's
  failed-dispatch view (§4) is the backstop for anything that does exhaust
  retries before that happens.
- [Extending `record_move`/`open_application`/`delete_application`/`register`
  to also write `dispatch` rows couples two components' writes in one
  transaction] → still one-directional (Stayover doesn't read anything
  Delivery-owned to do its own job; it only writes rows Delivery later reads),
  so Law 4 holds; the coupling is the price of Decision a's "no service key"
  choice and is explicit here rather than hidden.
- [Two Gmail app passwords on one account (Decision c) is an extra manual setup
  step] → documented once in setup.md alongside foundation's existing Gmail
  SMTP setup step; no ongoing cost.

## Migration Plan

Additive only: new `dispatch` table and its functions; small additive changes
to `stays`' and foundation's writing functions (insert a `dispatch` row where
none existed before — does not change their existing return shape's meaning,
only what else runs inside the same transaction). No existing data migrated.
Rollback: drop the new migration and the (additive-only) statements it added to
the writing functions before real data exists, same posture as `stays` and
foundation.

## Open Questions

- Vercel's `after()` support — to confirm with one real send after the first
  deployment. Does not change the specs, the chosen approach, or the task
  breakdown (Decision b's fallback already assumes the pessimistic case).

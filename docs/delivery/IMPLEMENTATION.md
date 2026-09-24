# Delivery — implementation map

> The functor ARCHITECTURE.md → code. Each object/morphism → the file:symbol that
> realises it. Keep in sync WITH the code (§6.3): a new morphism gets a row here in
> the same change that adds its code.

## Objects (Dat) → code

| Object | Form / shape | Realised at | State |
| --- | --- | --- | --- |
| `Dispatch` | delivery audit: recipient, kind, revision, attempts, status, `payload` snapshot | `supabase/migrations/20260924001100_delivery_outbox.sql:dispatch`, `20260924001200_delivery_queue.sql:dispatch.payload`; TS shape at `src/delivery/send-pending-dispatches.ts:DispatchRow` | built |
| `CalendarEvent` | all-day event: deduced from agreed dates, not stored | `src/delivery/types.ts:CalendarEvent` | built (deduced) |

## Morphisms (Trn / relations) → code

| Morphism | Signature | Realising code | State |
| --- | --- | --- | --- |
| `d_member?` | `Dispatch → Member` (partial; not for admin notices) | `dispatch.member_id` (queued null for `MemberWaiting` notices — `20260924001200_delivery_queue.sql:register`) | built |
| `d_to` | `Dispatch → 𝕊` (recipient address) | `dispatch.to_email`, resolved once at queue time (`app_private.stayover_side_members`/`stayover_participants`, `20260924001200_delivery_queue.sql`) | built |
| `d_application?` | `Dispatch → Application` | `dispatch.application_id`, `on delete set null` (nulled by `delete_application`'s hard delete) | built |
| `d_kind` | `Dispatch → {NOTICE, INVITE}` | `dispatch.kind` | built |
| `d_revision` | `Dispatch → ℕ` | `dispatch.revision` | built |
| `d_attempts` | `Dispatch → ℕ` | `dispatch.attempts`, incremented in `record_dispatch_outcome` | built |
| `d_status` | `Dispatch → {SENT, FAILED}` | `dispatch.status` (plus `pending` in between attempts) | built |
| `d_error?` | `Dispatch → 𝕊` | `dispatch.last_error` | built |
| `d_at` | `Dispatch → Instant` | `dispatch.updated_at` | built |
| `event?` | `Application → CalendarEvent` (deduced) | `src/delivery/build-event.ts:buildEvent`, called from `src/delivery/dispatch-render.ts` against `dispatch.payload` | built |
| `ev_uid` | `CalendarEvent → 𝕊` (deduced) | `build-event.ts:buildEvent` (`${applicationId}@lyanne-visa`) | built |
| `ev_sequence` | `CalendarEvent → ℕ` (deduced) | `build-event.ts:buildEvent` (`= revision`) | built |
| `ev_method` | `CalendarEvent → {REQUEST, CANCEL}` (deduced) | `build-event.ts:buildEvent` | built |
| `ev_span` | `CalendarEvent → DateRange` (deduced) | `build-event.ts:buildEvent` | built |
| `ev_title` | `CalendarEvent → 𝕊` (deduced) | `build-event.ts:buildEvent` | built |
| `ev_location?` | `CalendarEvent → 𝕊` (deduced) | `build-event.ts:buildEvent` | built |
| `ev_organizer` | `CalendarEvent → 𝕊` (deduced) | `src/delivery/send-pending-dispatches.server.ts` (`DELIVERY_FROM_ADDRESS`, or a console-mode placeholder) | built |
| `ev_attendees` | `CalendarEvent → 𝕊*` (deduced) | `dispatch.payload.attendees`, snapshotted by `app_private.stayover_participants` | built |
| `planDelivery` | `StayoverEvent → PlannedDispatch*` (pure) | `src/delivery/events.ts:planDelivery` — a cross-check function only; the SQL-side queuing (`20260924001200_delivery_queue.sql`) is the real runtime path (design.md Decision a) | built |
| `buildEvent` | `calendarFacts → CalendarEvent` (pure) | `src/delivery/build-event.ts:buildEvent` | built |
| `renderIcs` | `CalendarEvent → 𝕊` (pure, RFC 5545) | `src/delivery/render-ics.ts:renderIcs` | built |
| `renderNotice` | flat `NoticeFacts → EmailMessage` (pure; deviates from the literal `StayoverEvent × Member` signature — see `render-notice.ts`'s header comment for why) | `src/delivery/render-notice.ts:renderNotice` | built |
| `sendEmail ⊸` | `EmailMessage → SendResult` (port `Mailer`) | `src/delivery/types.ts:Mailer`, `mailer-smtp.ts:createSmtpMailer`, `mailer-console.ts:createConsoleMailer`, selected by `mailer.ts:getMailer` | built |
| `dispatch ⊸` | `PlannedDispatch → Dispatch` (send with bounded retry, record) | `src/delivery/send-pending-dispatches.ts:sendPendingDispatches` (pure loop) wired to Postgres by `send-pending-dispatches.server.ts:sendPendingDispatchesFromRequest` | built |
| `t_stayover_event` (port in) | `Stayover → Delivery`, carries `StayoverEvent` | Realised as a DB-side outbox instead (design.md Decision a): `record_move`/`open_application`/`delete_application`/`register` insert `dispatch` rows directly, in the same transaction as the domain write — `20260924001200_delivery_queue.sql` | built (realised differently than ARCHITECTURE.md's original sketch — see Notes below) |
| `participants` (read) | `Application → Member*` (deduced in Stayover) | `app_private.stayover_participants` (`20260924001200_delivery_queue.sql`) — a Delivery-owned copy of the same deduction, not a call into Stayover's own `application_participants` (avoids a cross-component RLS dependency at queue time) | built |
| `calendarFacts` (read) | `Application → (agreed?, revision, phase, …)` (deduced in Stayover) | Snapshotted into `dispatch.payload` at queue time (`20260924001200_delivery_queue.sql`), not read live — see migration header comment "Rendering-without-RLS choice" | built |
| `Mailer` (port) | `EmailMessage → SendResult ⊸`; adapters: Gmail SMTP, console double | `src/delivery/mailer.ts`, `mailer-smtp.ts`, `mailer-console.ts` | built |
| `claim_pending_dispatches` / `record_dispatch_outcome` (worker-secret-gated) | `Db ⊸` | `20260924001100_delivery_outbox.sql` | built |
| `dispatch_is_superseded` (worker-secret-gated) | `(application, revision) → 𝔹` — realises composition rule 3's "dropped if a newer revision already dispatched" | `20260924001200_delivery_queue.sql:dispatch_is_superseded` | built |
| `admin_failed_dispatches` | admin-only read, no secrets in projection | `20260924001200_delivery_queue.sql:admin_failed_dispatches`, `src/delivery/data/admin.ts`, `src/ui/screens/AdminDeliveries.tsx`, `src/app/admin/deliveries/page.tsx` | built |
| `application_dispatch_summary` | participant-only read for the UI's quiet status line (ui-design-brief.md §5 "Stage 4") | `20260924001200_delivery_queue.sql:application_dispatch_summary`, `src/delivery/data/stays.ts`, `src/ui/types.ts:ApplicationDetailProps.deliveryStatus` | built |

## Composition rules → where enforced

| Rule (ARCHITECTURE §6) | Enforced at | State |
| --- | --- | --- |
| 1. Deliver after commit, never inside it | Domain write commits inside the SQL function before dispatch rows are inserted (same transaction, but after the write — `20260924001200_delivery_queue.sql`); delivery itself runs after the response, via `after()` (`src/stayover/actions/stays.ts`, `register.ts`) or the traffic fallback (`src/proxy.ts`) | built |
| 2. Bounded retry | `dispatch_failed_at_fourth_attempt` check constraint + `record_dispatch_outcome`'s attempt counting (`20260924001100_delivery_outbox.sql`) | built |
| 3. Monotone sequence | `dispatch.revision` = the fold's own revision counter; `dispatch_is_superseded` drops a stale retry (`20260924001200_delivery_queue.sql`) | built |
| 4. Calendar follows agreed? only | `record_move` only queues an invite on `accept`/`cancel-after-agreement`, never on `propose`/`reject` (`20260924001200_delivery_queue.sql`) | built |
| 5. Stable identity | `ev_uid = '<application id>@lyanne-visa'` (`build-event.ts:buildEvent`) | built |
| 6. Secrets stay server-side | `DELIVERY_SMTP_*`/`DELIVERY_FROM_ADDRESS` read only in `mailer-smtp.ts`; `DELIVERY_WORKER_SECRET` read only in `worker-secret.ts` (both verified by `mailer.test.ts`'s import-boundary test) | built |
| 7. Recipients are participants | `app_private.stayover_side_members`/`stayover_participants` — active guardians/hosts only, never a raw table scan (`20260924001200_delivery_queue.sql`) | built |

## Notes / divergences

- **`t_stayover_event` realised as a DB-side outbox, not a TS-level port call.** ARCHITECTURE.md §8 models `t_stayover_event` as a same-invocation value Stayover hands to Delivery. design.md Decision a (this component's own design doc) chose instead to have the SQL functions that already write Stayover's domain changes also insert `dispatch` rows directly, inside the same transaction — see that migration's header comment for the full reasoning (no service-role key; the sensitive `auth.users` read happens exactly once, at the write it's caused by). `src/stayover/events.ts`'s `StayoverEvent`/`emitStayoverEvent` — the TS-level port `stays` already built — is kept only as a dev-log line (`console.info("[stayover event]", event.kind)`, redacted of participant emails this pass); it is not consumed by Delivery at runtime.
- **`renderNotice`'s signature is flat (`NoticeFacts`), not `StayoverEvent × Member`.** At render time the only input available is `dispatch.payload` (the jsonb snapshot taken at queue time — see the "Rendering-without-RLS choice" comment in `20260924001200_delivery_queue.sql`), which is already this flat shape, not a reconstructed `StayoverEvent`. `src/delivery/events.ts`'s own `StayoverEvent`/`planDelivery` remain the model this shape is drawn from and are cross-checked against the SQL-side queuing in `events.test.ts` (one case per row of ARCHITECTURE.md §5's table) — they are just not the thing that actually runs at send time.
- **Rendering-without-RLS**: a `payload jsonb` snapshot column on `dispatch`, not a secret-gated `dispatch_render_facts` function — chosen and justified in `20260924001200_delivery_queue.sql`'s own header comment.
- **Open item (unresolved, tracked in STATUS.md):** Netlify's exact `after()`/`waitUntil` behaviour is still unverified from anything installed in this repo — correctness does not depend on it (the traffic-triggered fallback in `src/proxy.ts` covers the case where it does nothing), but promptness does.

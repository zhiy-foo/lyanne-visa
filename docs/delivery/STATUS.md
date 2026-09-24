# Delivery — status

> Reconciles ARCHITECTURE.md (intent) vs IMPLEMENTATION.md (code). Updated whenever
> code changes what is done (§6.5).

## Headline

✅ built — every object, morphism and composition rule in ARCHITECTURE.md is realised in code and covered by tests (`npx vitest run`: 537 tests passing, including `test/db/delivery-outbox.test.ts`, `test/db/delivery-queue.test.ts` and everything under `src/delivery/`). One item to confirm: Vercel supports `after()` natively via `waitUntil` — verify with one real send after the first deployment.

## Completeness

| Object / morphism | State | Notes |
| --- | --- | --- |
| `Dispatch` | ✅ built | `dispatch` table + `payload` snapshot column |
| `CalendarEvent` | ✅ built | deduced, not stored |
| `planDelivery` | ✅ built | cross-check function only; SQL-side queuing is the real runtime path |
| `buildEvent` | ✅ built | |
| `renderIcs` | ✅ built | |
| `renderNotice` | ✅ built | flat `NoticeFacts` signature — see IMPLEMENTATION.md's Notes |
| `sendEmail ⊸` | ✅ built | Gmail SMTP + console double, selected by env |
| `dispatch ⊸` | ✅ built | pure loop (`sendPendingDispatches`) + real Postgres wiring |
| Rule 1 (deliver after commit) | ✅ built | `after()` in stays/register actions + `src/proxy.ts` fallback |
| Rule 2 (bounded retry) | ✅ built | DB check constraint + `record_dispatch_outcome` |
| Rule 3 (monotone sequence) | ✅ built | `dispatch_is_superseded` |
| Rule 4 (calendar follows agreed?) | ✅ built | |
| Rule 5 (stable identity) | ✅ built | |
| Rule 6 (secrets server-side) | ✅ built | verified by `mailer.test.ts`'s import-boundary test |
| Rule 7 (recipients are participants) | ✅ built | |

## Needs work

- Admin nav badge for "Deliveries" only shows a live failed-count on the `/admin/deliveries` page itself; the other three admin pages (`/admin/accounts`, `/children`, `/homes`) pass `0` for it rather than an extra query per page load — a real count would need `admin_failed_dispatches()` called from every admin page, which this pass judged not worth the extra round-trip for a badge. Not a correctness gap (the page itself always shows the truth), just a minor nav polish item.
- The "add to contacts" tip's one-time dismissal is remembered in the browser's `localStorage` (`src/app/applications/ApplicationsClient.tsx`), not server-side per-member state — it can reappear after clearing browser storage or on a new device. Acceptable for a low-stakes, repeatable-without-harm tip; a `member`-level flag would be the alternative if this needs to be sturdier later.

## Coherence

No laws currently failing.

- **Law 1** (`buildEvent` reads only `calendarFacts`): holds — `buildEvent` takes a `CalendarFacts` argument built entirely from `dispatch.payload`, never a live Stayover read.
- **Law 2** (`t_mail` typed, no credential on any `Trm` to `Browser`): holds — `EmailMessage` never carries a credential; `DELIVERY_SMTP_*`/`DELIVERY_FROM_ADDRESS`/`DELIVERY_WORKER_SECRET` are each read in exactly one module, verified by `mailer.test.ts`'s static-source-scan import-boundary test.
- **Law 4 / hexagonal**: holds in spirit, realised differently than ARCHITECTURE.md's original sketch — see IMPLEMENTATION.md's "Notes / divergences" for the DB-side-outbox rationale (design.md Decision a). Stayover's SQL functions write `dispatch` rows but never read anything Delivery-owned back, so the dependency is still one-directional.
- **`src/ui/` boundary**: `src/ui/boundary.test.ts` (a repo-wide scan, no per-file allowlist to maintain) confirms `AdminDeliveries.tsx` and every other new/changed `src/ui/` file stays free of server/Supabase/routing imports.

## Open questions

- ~~**O3:** Which email provider and sending address?~~ **Resolved 2026-09-23:** Gmail SMTP from a dedicated app Gmail account (app password; ~500 sends/day). No free domain option is viable. Swap to a domain-based provider behind `Mailer` if a domain is bought later.
- ~~**O4:** The Google OAuth app must be set to "In production" (unverified) rather than "Testing", because Testing-mode refresh tokens expire after 7 days. Consequence: users see an "unverified app" warning; cap of 100 users.~~ **Resolved 2026-09-23:** No Google Calendar API — calendar delivery is emailed .ics invites only.
- ~~**O5:** When a member disconnects Google Calendar, delete the events we created or leave them?~~ **Resolved 2026-09-23 (moot):** No calendar connections exist.
- ~~**O6:** Retry of FAILED dispatches: manual "retry" button only (v1 assumption), or a scheduled job?~~ **Resolved 2026-09-23:** Automatic — one send plus up to 3 retries with backoff, then FAILED and stop (delivery rule 2).
- ~~**O7:** Sign-in methods~~ **Resolved 2026-09-23:** email magic link plus Google sign-in — see [../stayover/STATUS.md](../stayover/STATUS.md).
- **O8:** Vercel supports `after()` natively via `waitUntil` — confirm with one real send after the first deployment. Does not affect correctness — `src/proxy.ts`'s throttled traffic-triggered fallback (design.md Decision b step 3) guarantees eventual delivery regardless — only how promptly a mail goes out.

## Where to dig

- Model: ARCHITECTURE.md · Code map: IMPLEMENTATION.md
- In flight: `openspec/changes/` · Reviews: reviews/ · Notes: general/

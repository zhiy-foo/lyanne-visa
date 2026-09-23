# Delivery — status

> Reconciles ARCHITECTURE.md (intent) vs IMPLEMENTATION.md (code). Updated whenever
> code changes what is done (§6.5).

## Headline

⬜ unbuilt — greenfield, model only. All objects and morphisms documented in ARCHITECTURE.md; code realisation is planned.

## Completeness

| Object / morphism | State | Notes |
| --- | --- | --- |
| `Dispatch` | ⬜ unbuilt | |
| `CalendarEvent` | ⬜ unbuilt | deduced, not stored |
| `planDelivery` | ⬜ unbuilt | |
| `buildEvent` | ⬜ unbuilt | |
| `renderIcs` | ⬜ unbuilt | |
| `renderNotice` | ⬜ unbuilt | |
| `sendEmail ⊸` | ⬜ unbuilt | port to Mailer |
| `dispatch ⊸` | ⬜ unbuilt | bounded retry, record |
| Rule 1 (deliver after commit) | ⬜ unbuilt | |
| Rule 2 (bounded retry) | ⬜ unbuilt | |
| Rule 3 (monotone sequence) | ⬜ unbuilt | |
| Rule 4 (calendar follows agreed?) | ⬜ unbuilt | |
| Rule 5 (stable identity) | ⬜ unbuilt | |
| Rule 6 (secrets server-side) | ⬜ unbuilt | |
| Rule 7 (recipients are participants) | ⬜ unbuilt | |

## Needs work

Everything — this is the first pass of a greenfield model.

## Coherence

No laws currently failing — model is at design stage, awaiting code realisation.

## Open questions

- ~~**O3:** Which email provider and sending address?~~ **Resolved 2026-09-23:** Gmail SMTP from a dedicated app Gmail account (app password; ~500 sends/day). No free domain option is viable. Swap to a domain-based provider behind `Mailer` if a domain is bought later.
- ~~**O4:** The Google OAuth app must be set to "In production" (unverified) rather than "Testing", because Testing-mode refresh tokens expire after 7 days. Consequence: users see an "unverified app" warning; cap of 100 users.~~ **Resolved 2026-09-23:** No Google Calendar API — calendar delivery is emailed .ics invites only.
- ~~**O5:** When a member disconnects Google Calendar, delete the events we created or leave them?~~ **Resolved 2026-09-23 (moot):** No calendar connections exist.
- ~~**O6:** Retry of FAILED dispatches: manual "retry" button only (v1 assumption), or a scheduled job?~~ **Resolved 2026-09-23:** Automatic — one send plus up to 3 retries with backoff, then FAILED and stop (delivery rule 2).
- ~~**O7:** Sign-in methods~~ **Resolved 2026-09-23:** email magic link plus Google sign-in — see [../stayover/STATUS.md](../stayover/STATUS.md).

## Where to dig

- Model: ARCHITECTURE.md · Code map: IMPLEMENTATION.md
- In flight: `openspec/changes/` · Reviews: reviews/ · Notes: general/

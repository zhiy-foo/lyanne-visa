# Tasks

## 1. Schema

- [ ] 1.1 Migration adding `application` and `move` tables per design Decision 1 (insert-only `move`, check constraint `mv_dates? ⟺ kind = 'propose'`, `date_start < date_end`); add `place.capacity int null check (capacity is null or capacity > 0)`; verify `supabase db reset` / the PGlite harness applies cleanly
- [ ] 1.2 Add a `tstzrange`/date-range exclusion constraint (or equivalent) on agreed ranges per child as defence in depth for rule 6, alongside the transactional check in 2.2; verify a PGlite test that two concurrent `accept` calls for overlapping dates on the same child cannot both succeed

## 2. Fold, moves and checks (design Decisions 2–5)

- [ ] 2.1 `app_private.fold_application(uuid)` implementing the §5 state table (status, awaiting, agreed dates, open proposal dates, revision); verify unit-style PGlite tests for every row of the state table (propose→negotiating, accept→confirmed, propose-after-agreement→confirmed+awaiting, reject-with-agreement→confirmed, reject-no-agreement→rejected terminal, cancel→cancelled terminal, no move after terminal)
- [ ] 2.2 `record_move(application, kind, date_start?, date_end?, note?)`: resolves side via `app_private.my_child_ids()`/`my_place_ids()` (never a raw `guardian`/`place_host` join — insulates this change from `co-parent-requests`), enforces rule 4 legality and rule 2 date shape, and on a confirming/re-confirming `accept` runs the overlap check (rule 6) and, if `place.capacity` is set, the capacity check (design Decision 4), all inside one locked transaction; verify a refusal test per rule: wrong-side accept/reject, move on terminal application, bad date range, overlapping accept, capacity-exceeding accept — plus a happy path per move kind
- [ ] 2.3 `open_application(child, place, date_start, date_end, note?)`: creates the application and its first `propose` move (rule 3); verify: only an active parent guardian of the child may call it, refused for a host, refused for a non-guardian parent, invalid dates refused
- [ ] 2.4 `place_capacity_status(place, date_start, date_end)` (design Decision 5) returning per-night agreed counts and an at-capacity flag; verify: correct counts across a multi-night range, unaffected by a place with no capacity set, unaffected by other children's non-agreed (still-negotiating) applications
- [ ] 2.5 `delete_application(application)` (design Decision 6): refuses unless every move's side is `'parent'` (rule 13), deletes moves then the application in one transaction, returns the pre-delete snapshot (child name, place name, host member ids, agreed/open dates); verify: succeeds while unanswered, refused once a host has moved, refused for a host caller, snapshot fields are correct
- [ ] 2.6 Client-side `validateMove` mirroring 2.2's legality/overlap/capacity checks against already-loaded state, used only to enable/disable UI controls (Law 6); verify unit tests against the same table as 2.1/2.2, and a test that it never itself performs a write

## 3. Visibility (design Decision 8)

- [ ] 3.1 `application`/`move` RLS `SELECT` policies: guardian of the child, host of the place, or admin; no write grants to `authenticated` (every write goes through 2.2/2.3/2.5); verify: parent guardian sees it, place host sees it, an uninvolved active member sees nothing, waiting/deactivated members see nothing, admin sees everything, a direct `INSERT`/`UPDATE`/`DELETE` on either table by any app role is refused
- [ ] 3.2 Widen `child`'s `SELECT` policy so a host of a place the child has an application at can see that child (name only, via the application), and widen `place`'s `SELECT` policy so a parent who has applied there can see its address; verify: host sees the child's name only after an application exists, not before; parent sees the address only after applying, not before; existing foundation visibility (guardians, place hosts, directory-without-address) is unaffected — rerun the foundation RLS tests unmodified
- [ ] 3.3 Admin never gets an `execute` grant on `record_move`/`open_application`/`delete_application` acting on their own behalf as a participant (they have none) — verify calling any of the three as the admin is refused (no side to act as), while admin reads (3.1) still succeed

## 4. Stayover event port (design Decision 7)

- [ ] 4.1 Define the `StayoverEvent` TypeScript type (`MoveCommitted` / `ApplicationDeleted`) and the `participants`/`calendarFacts` deduced read functions in `src/stayover/`; verify unit tests build the correct event shape from a `record_move`/`delete_application` result, including the `ApplicationDeleted` snapshot after the row is gone
- [ ] 4.2 Wire server actions so every successful move/delete builds and returns its `StayoverEvent` to the caller after the database call commits (no consumer yet — `email-delivery` reads this port); verify a test that a failed move never produces an event and a successful one always does

## 5. Server actions and data loaders

- [ ] 5.1 Parent actions: open an application, propose/accept/reject/cancel, hard-delete, mapping every `P0001` refusal to the spec's messages (incl. the capacity warning as a pre-submit read, not a refusal); verify unit tests for the error mapping
- [ ] 5.2 Host actions: propose/accept/reject/cancel, set/clear home capacity; verify unit tests for the error mapping and that a host cannot open or delete an application
- [ ] 5.3 Data loaders for Overview (attention banner count, month calendar days), Applications list (grouped), Application detail (status/dates/history/`can`); verify unit tests that grouping and the `can` flags match §5's state table for each phase/side combination

## 6. UI (stage 2, per design-reference.md and ui-design-brief.md §5)

- [ ] 6.1 `Overview` screen (greeting, attention banner, month calendar with ✓ confirmed / dashed "?" not-agreed days, tap-through to detail) per the prop contract in ui-design-brief.md; verify a `src/ui/` boundary test (no Supabase/server imports) and add every state (no attention, one stay needing answer, calendar with mixed confirmed/unagreed days) to `src/ui/fixtures.ts` and the `/dev/gallery` registry
- [ ] 6.2 `ApplicationsList`/`StaysHome` grouping screen (needs-your-answer / upcoming / past) per its prop contract; verify boundary test and gallery states for empty, and all three groups populated
- [ ] 6.3 `PlanAStay`/`NewApplication` form (parents only) with the capacity warning banner from 2.4/5.1; verify boundary test and gallery states: default, capacity warning shown, refusal message (overlap)
- [ ] 6.4 `ApplicationDetail` screen (status badge, dates, nights · child at place, latest-move attention banner, history timeline, `can`-gated actions with confirm dialogs, suggest-other-dates date-range picker) per its prop contract, explicitly excluding stage-3 `StayDetails` sections; verify boundary test and gallery states for every phase × side combination in ui-design-brief.md's state list
- [ ] 6.5 Extend the navigation drawer: parents get "Overview · Applications · Plan a stay · My children"; hosts get "Overview · Applications · My home"; verify a routing/nav test per role
- [ ] 6.6 Screenshot every new stage-2 screen and state at 390px and 1280px, both themes, into `docs/stayover/reviews/stays-screens/` with Playwright, matching foundation task 4.3's pattern

## 7. Verification and reconcile

- [ ] 7.1 Run the full suite, lint and build; verify every spec scenario in `specs/stays/spec.md` has a matching test, and the capacity/double-booking checks are specifically exercised under concurrent "latest move" semantics (two proposals racing to accept)
- [ ] 7.2 Reconcile docs: add realised rows (`file:symbol`, state `built`) to `docs/stayover/IMPLEMENTATION.md` for every Trn/rule this change realises (rules 2–8, 10–13 as applicable, the capacity rule once added to ARCHITECTURE.md §6, `authorize`'s per-application case, `render` for application views); update `docs/stayover/STATUS.md` and `docs/architecture-map.md` §5 coherence checklist; add the capacity morphism and its composition rule to ARCHITECTURE.md §4/§6 (STATUS.md "Needs work" already commits to this); run the supercharge drift check and verify it reports 0 dead

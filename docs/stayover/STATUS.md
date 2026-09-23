# Stayover — status

> Reconciles ARCHITECTURE.md (intent) vs IMPLEMENTATION.md (code). Updated whenever
> code changes what is done (§6.5).

## Headline

⬜ unbuilt — greenfield, model only. All objects and morphisms documented in ARCHITECTURE.md; code realisation is planned.

## Completeness

| Object / morphism | State | Notes |
| --- | --- | --- |
| `Member` | ⬜ unbuilt | in flight: `openspec/changes/foundation/` |
| `Child` | ⬜ unbuilt | in flight: `openspec/changes/foundation/` |
| `Place` | ⬜ unbuilt | in flight: `openspec/changes/foundation/` |
| `Guardian` | ⬜ unbuilt | in flight: `openspec/changes/foundation/` |
| `PlaceHost` | ⬜ unbuilt | in flight: `openspec/changes/foundation/` |
| `Application` | ⬜ unbuilt | |
| `Move` | ⬜ unbuilt | |
| `DateRange` | ⬜ unbuilt | |
| `StayDetails` | ⬜ unbuilt | |
| `CareNote` | ⬜ unbuilt | |
| `Handover` | ⬜ unbuilt | |
| `Flight` | ⬜ unbuilt | |
| `Contact` | ⬜ unbuilt | |
| `register ⊸` | ⬜ unbuilt | in flight: `openspec/changes/foundation/` |
| `addChild ⊸` | ⬜ unbuilt | in flight: `openspec/changes/foundation/` |
| `addPlace ⊸` | ⬜ unbuilt | in flight: `openspec/changes/foundation/` |
| `linkGuardian ⊸` | ⬜ unbuilt | in flight: `openspec/changes/foundation/` |
| `linkHost ⊸` | ⬜ unbuilt | in flight: `openspec/changes/foundation/` |
| `deactivate ⊸` | ⬜ unbuilt | in flight: `openspec/changes/foundation/` |
| `reactivate ⊸` | ⬜ unbuilt | in flight: `openspec/changes/foundation/` |
| `setRole ⊸` | ⬜ unbuilt | in flight: `openspec/changes/foundation/` |
| `approve ⊸` / `decline ⊸` | ⬜ unbuilt | in flight: `openspec/changes/foundation/` |
| `setJoinCode ⊸` / `checkJoinCode` | ⬜ unbuilt | in flight: `openspec/changes/foundation/` |
| `m_status` / `joinCode` | ⬜ unbuilt | in flight: `openspec/changes/foundation/` |
| `authorize` | ⬜ unbuilt | in flight: `openspec/changes/foundation/` |
| `validateMove` | ⬜ unbuilt | |
| `recordMove ⊸` | ⬜ unbuilt | |
| `foldStatus` | ⬜ unbuilt | |
| `checkOverlap` | ⬜ unbuilt | |
| `applyTemplate ⊸` | ⬜ unbuilt | |
| `saveAsTemplate ⊸` | ⬜ unbuilt | |
| `deleteApplication ⊸` | ⬜ unbuilt | |
| `render` | ⬜ unbuilt | |
| Rule 1 (Self-service registration) | ⬜ unbuilt | in flight: `openspec/changes/foundation/` |
| Rule 2 (Proposal shape) | ⬜ unbuilt | |
| Rule 3 (Parents open) | ⬜ unbuilt | |
| Rule 4 (Move legality) | ⬜ unbuilt | |
| Rule 5 (Side is snapshotted) | ⬜ unbuilt | |
| Rule 6 (No double-booking) | ⬜ unbuilt | |
| Rule 7 (Template discriminator) | ⬜ unbuilt | |
| Rule 8 (Templates are copied, deliberately) | ⬜ unbuilt | |
| Rule 9 (Details are not negotiated) | ⬜ unbuilt | |
| Rule 10 (Owners create, the admin oversees) | ⬜ unbuilt | in flight: `openspec/changes/foundation/` |
| Rule 11 (Links agree with role) | ⬜ unbuilt | in flight: `openspec/changes/foundation/` |
| Rule 12 (Visibility is by side) | ⬜ unbuilt | in flight: `openspec/changes/foundation/` |
| Rule 13 (Hard delete only while unanswered) | ⬜ unbuilt | |
| Rule 14 (Every child has a parent) | ⬜ unbuilt | in flight: `openspec/changes/foundation/` |
| Rule 15 (The admin is not a member) | ⬜ unbuilt | in flight: `openspec/changes/foundation/` |
| Rule 16 (One profile per identity) | ⬜ unbuilt | in flight: `openspec/changes/foundation/` |
| Rule 17 (Deactivation keeps history) | ⬜ unbuilt | in flight: `openspec/changes/foundation/` |
| Rule 18 (Role changes are admin-only and link-free) | ⬜ unbuilt | in flight: `openspec/changes/foundation/` |
| Rule 19 (Emails compare case-insensitively) | ⬜ unbuilt | in flight: `openspec/changes/foundation/` |
| Rule 20 (Every place has a host) | ⬜ unbuilt | in flight: `openspec/changes/foundation/` |
| Rule 21 (Join code) | ⬜ unbuilt | in flight: `openspec/changes/foundation/` |

## Needs work

Everything — this is the first pass of a greenfield model.

## Coherence

No laws currently failing — model is at design stage, awaiting code realisation.

## Open questions

- ~~**O1:** May both sides edit StayDetails freely without re-acceptance?~~ **Resolved 2026-09-23: yes** — rule 9 stands; only dates are negotiated.
- ~~**O2:** Can every family member read every application in the family (v1 assumption: yes), or only the parents and hosts involved?~~ **Resolved 2026-09-23:** parents create/read/update/delete (delete = cancel, or permanent delete only while no host has responded); hosts read/update/deny (deny = reject or cancel, never delete); nobody else sees an application. See stayover rules 12–13 and the Permissions table.
- ~~**O7:** Sign-in methods — email magic link only, or also 'Sign in with Google'?~~ **Resolved 2026-09-23:** both. Google sign-in uses a Google Cloud OAuth client with basic scopes (openid, email, profile) only — no verification, no warning screen. Either method yields a verified email.
- ~~**O8:** Account model~~ **Resolved 2026-09-23:** self-registration with one role (parent or host), active immediately; a configured admin account (lyanne.stayovers@gmail.com) manages accounts; single tenant, no Family object; home addresses shown only to the home's hosts, the admin and parents who applied there.
- ~~**O9:** Limiting open registration; hosting~~ **Resolved 2026-09-24:** family join code ⟹ active immediately, otherwise a waiting list the admin approves or declines (admin emailed from change 4); hosting on Netlify (GitHub Pages cannot run the server parts).

## Where to dig

- Model: ARCHITECTURE.md · Code map: IMPLEMENTATION.md
- In flight: `openspec/changes/` · Reviews: reviews/ · Notes: general/

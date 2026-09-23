# Stayover — status

> Reconciles ARCHITECTURE.md (intent) vs IMPLEMENTATION.md (code). Updated whenever
> code changes what is done (§6.5).

## Headline

⬜ unbuilt — greenfield, model only. All objects and morphisms documented in ARCHITECTURE.md; code realisation is planned.

## Completeness

| Object / morphism | State | Notes |
| --- | --- | --- |
| `Family` | ⬜ unbuilt | |
| `Member` | ⬜ unbuilt | |
| `Child` | ⬜ unbuilt | |
| `Place` | ⬜ unbuilt | |
| `Guardian` | ⬜ unbuilt | |
| `PlaceHost` | ⬜ unbuilt | |
| `Application` | ⬜ unbuilt | |
| `Move` | ⬜ unbuilt | |
| `DateRange` | ⬜ unbuilt | |
| `StayDetails` | ⬜ unbuilt | |
| `CareNote` | ⬜ unbuilt | |
| `Handover` | ⬜ unbuilt | |
| `Flight` | ⬜ unbuilt | |
| `Contact` | ⬜ unbuilt | |
| `inviteMember ⊸` | ⬜ unbuilt | |
| `bindUser ⊸` | ⬜ unbuilt | |
| `authorize` | ⬜ unbuilt | |
| `validateMove` | ⬜ unbuilt | |
| `recordMove ⊸` | ⬜ unbuilt | |
| `foldStatus` | ⬜ unbuilt | |
| `checkOverlap` | ⬜ unbuilt | |
| `applyTemplate ⊸` | ⬜ unbuilt | |
| `saveAsTemplate ⊸` | ⬜ unbuilt | |
| `deleteApplication ⊸` | ⬜ unbuilt | |
| `render` | ⬜ unbuilt | |
| Rule 1 (tenant) | ⬜ unbuilt | |
| Rule 2 (proposal shape) | ⬜ unbuilt | |
| Rule 3 (parents open) | ⬜ unbuilt | |
| Rule 4 (move legality) | ⬜ unbuilt | |
| Rule 5 (side snapshotted) | ⬜ unbuilt | |
| Rule 6 (no double-booking) | ⬜ unbuilt | |
| Rule 7 (template discriminator) | ⬜ unbuilt | |
| Rule 8 (templates copied) | ⬜ unbuilt | |
| Rule 9 (details not negotiated) | ⬜ unbuilt | |
| Rule 10 (invite binding) | ⬜ unbuilt | |
| Rule 11 (one side per application) | ⬜ unbuilt | |
| Rule 12 (visibility by side) | ⬜ unbuilt | |
| Rule 13 (hard delete only while unanswered) | ⬜ unbuilt | |

## Needs work

Everything — this is the first pass of a greenfield model.

## Coherence

No laws currently failing — model is at design stage, awaiting code realisation.

## Open questions

- ~~**O1:** May both sides edit StayDetails freely without re-acceptance?~~ **Resolved 2026-09-23: yes** — rule 9 stands; only dates are negotiated.
- ~~**O2:** Can every family member read every application in the family (v1 assumption: yes), or only the parents and hosts involved?~~ **Resolved 2026-09-23:** parents create/read/update/delete (delete = cancel, or permanent delete only while no host has responded); hosts read/update/deny (deny = reject or cancel, never delete); nobody else sees an application. See stayover rules 12–13 and the Permissions table.
- ~~**O7:** Sign-in methods — email magic link only, or also 'Sign in with Google'?~~ **Resolved 2026-09-23:** both. Google sign-in uses a Google Cloud OAuth client with basic scopes (openid, email, profile) only — no verification, no warning screen. Invite binding (rule 10) matches on email either way.

## Where to dig

- Model: ARCHITECTURE.md · Code map: IMPLEMENTATION.md
- In flight: `openspec/changes/` · Reviews: reviews/ · Notes: general/

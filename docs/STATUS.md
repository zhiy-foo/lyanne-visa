# System status

> Roll-up of every <component>/STATUS.md. Detail lives in the linked file.

| Component | State | Headline gap | In flight | Detail |
| --- | --- | --- | --- | --- |
| Stayover | 🟡 partial | `Application` (and everything downstream: negotiation, stay details, calendar) unbuilt | foundation 16/16 (awaiting live smoke) | [stayover/STATUS.md](stayover/STATUS.md) |
| Delivery | ⬜ unbuilt | all objects and morphisms planned | — | [delivery/STATUS.md](delivery/STATUS.md) |

## Cross-cutting

Seven open questions span architecture assumptions and deployment choices:

- ~~**O1:** May both sides edit StayDetails freely without re-acceptance?~~ **Resolved 2026-09-23: yes**
- ~~**O2:** Can every family member read every application in the family (v1 assumption: yes), or only the parents and hosts involved?~~ **Resolved 2026-09-23:** parents create/read/update/delete (delete = cancel, or permanent delete only while no host has responded); hosts read/update/deny (deny = reject or cancel, never delete); nobody else sees an application. See [stayover/STATUS.md](stayover/STATUS.md).
- ~~**O3:** Which email provider and sending address?~~ **Resolved 2026-09-23:** Gmail SMTP. — [delivery/STATUS.md](delivery/STATUS.md)
- ~~**O4:** The Google OAuth app must be set to "In production" (unverified) rather than "Testing"...~~ **Resolved 2026-09-23:** No Google Calendar API. — [delivery/STATUS.md](delivery/STATUS.md)
- ~~**O5:** When a member disconnects Google Calendar, delete the events we created or leave them?~~ **Resolved 2026-09-23 (moot):** No calendar connections. — [delivery/STATUS.md](delivery/STATUS.md)
- ~~**O6:** Retry of FAILED dispatches: manual "retry" button only (v1 assumption), or a scheduled job?~~ **Resolved 2026-09-23:** Automatic (delivery rule 2). — [delivery/STATUS.md](delivery/STATUS.md)
- ~~**O7:** Sign-in methods~~ **Resolved 2026-09-23:** email magic link plus 'Sign in with Google' (basic scopes only). — [stayover/STATUS.md](stayover/STATUS.md)
- ~~**O8:** Account model~~ **Resolved 2026-09-23:** self-registration with one role, active immediately; configured admin account (lyanne.stayovers@gmail.com); single tenant, no Family object. — [stayover/STATUS.md](stayover/STATUS.md)
- ~~**O9:** Registration limits; hosting~~ **Resolved 2026-09-24:** join code or admin-approved waiting list; Vercel hosting. — [stayover/STATUS.md](stayover/STATUS.md)

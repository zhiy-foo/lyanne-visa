// buildEvent (task 3.1; docs/delivery/ARCHITECTURE.md §4 `event?`/`ev_*`):
// a pure function, `calendarFacts → CalendarEvent`. Dates in `CalendarFacts`
// are already `YYYY-MM-DD` day values local to the place's time zone (the
// app deals only in all-day events — there is no time-of-day component to
// convert, so "computed in p_tz" means the *source* dates were produced in
// that zone upstream, not that this function does zone arithmetic itself;
// see the migration comment in 20260924001200_delivery_queue.sql, which
// reads `agreed_start`/`agreed_end` as plain SQL `date` values with no zone
// conversion for the same reason).
//
// The calendar event's span is all-day from drop-off through pick-up day
// *inclusive* (owner decision 2026-09-24). Since DateRange is half-open
// (end is exclusive), we add 1 day to the agreed end date.

import type { CalendarEvent, DateRange } from "./types";

/** Adds whole days to a plain `YYYY-MM-DD` date, in UTC (no local zone). */
function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface CalendarFacts {
  applicationId: string;
  /** `agreed?` — the event is only ever built once this is defined
   * (ARCHITECTURE.md §4 `event?`: "defined iff agreed? was ever defined"). */
  agreed: DateRange;
  revision: number;
  phase: "negotiating" | "confirmed" | "rejected" | "cancelled";
  placeTimeZone: string;
  placeAddress?: string;
  childName: string;
  placeName: string;
  /** `ev_attendees`: `m_email ∘ participants` — already resolved upstream. */
  attendees: string[];
  /** `ev_organizer` — the app's sending address (config), passed in rather
   * than read from `process.env` here so this stays a pure function. */
  organizer: string;
}

/** `buildEvent : calendarFacts → CalendarEvent` (ARCHITECTURE.md §4). */
export function buildEvent(facts: CalendarFacts): CalendarEvent {
  return {
    // `ev_uid`: stable per application.
    uid: `${facts.applicationId}@lyanne-visa`,
    // `ev_sequence`: `= revision`.
    sequence: facts.revision,
    // `ev_method`: CANCEL iff phase = CANCELLED, REQUEST otherwise.
    method: facts.phase === "cancelled" ? "CANCEL" : "REQUEST",
    // `ev_span`: all-day, covering drop-off through pick-up day inclusive
    // (owner decision 2026-09-24). CalendarEvent.span is half-open, so its end
    // is the day after pick-up — renderIcs writes it as the exclusive DTEND.
    span: { start: facts.agreed.start, end: addDays(facts.agreed.end, 1) },
    // `ev_title`, e.g. "Lyanne at Grandma & Grandpa's".
    title: `${facts.childName} at ${facts.placeName}`,
    location: facts.placeAddress,
    organizer: facts.organizer,
    attendees: facts.attendees,
  };
}

// Delivery's own types (docs/delivery/ARCHITECTURE.md §4, §7, §8). Kept
// separate from `src/stayover/` — Delivery consumes Stayover's deduced reads
// (`StayoverEvent`, `calendarFacts`, `participants`) through a port, per
// ARCHITECTURE.md §8 and Law 4; it never imports `src/stayover/` types
// directly for its own domain objects.

/**
 * An all-day date span, half-open like `stays`' own `dr_end` (design.md
 * Decision — see stays design.md Decision 1): `start` is the first included
 * day, `end` is the day *after* the last included day (RFC 5545's own
 * `DTEND` convention for all-day events already matches this, so no
 * adjustment is needed when rendering — see renderIcs.ts).
 */
export interface DateRange {
  /** Inclusive first day, `YYYY-MM-DD`. */
  start: string;
  /** Exclusive day after the last included day, `YYYY-MM-DD`. */
  end: string;
}

/** `ev_method` (ARCHITECTURE.md §4): `REQUEST` for an active agreement, `CANCEL` once `phase = CANCELLED`. */
export type CalendarMethod = "REQUEST" | "CANCEL";

/**
 * `CalendarEvent` (ARCHITECTURE.md §3, §4) — deduced, never stored. Built by
 * `buildEvent` (task 3.1, not in this pass) from Stayover's `calendarFacts`;
 * `renderIcs` (task 3.2, this file's sibling) turns it into RFC 5545 text.
 */
export interface CalendarEvent {
  /** `ev_uid`: stable per application, `<application id>@lyanne-visa`. */
  uid: string;
  /** `ev_sequence`: `= revision`; strictly increases so calendars update in place. */
  sequence: number;
  /** `ev_method`. */
  method: CalendarMethod;
  /** `ev_span`: all-day, in the place's time zone. */
  span: DateRange;
  /** `ev_title`, e.g. "Lyanne at Grandma & Grandpa's". */
  title: string;
  /** `ev_location?`: `p_address?`. */
  location?: string;
  /** `ev_organizer`: the app's sending address. */
  organizer: string;
  /** `ev_attendees`: `m_email ∘ participants`. */
  attendees: string[];
}

/** An email message ready to hand to the `Mailer` port (ARCHITECTURE.md §7 `t_mail`). */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Present for `INVITE` dispatches — the rendered `.ics` text (renderIcs's output). */
  icsAttachment?: {
    filename: string;
    content: string;
    /** `REQUEST` invites use `method="REQUEST"`; cancellations `method="CANCEL"` (RFC 5546). */
    method: CalendarMethod;
  };
}

/** Outcome of one `Mailer.send` attempt. */
export type SendResult = { ok: true } | { ok: false; error: string };

/**
 * `Mailer` port (ARCHITECTURE.md §8): the only way an `EmailMessage` leaves
 * the app. Two realisations today (§5 YAGNI — Gmail SMTP and a console/test
 * double); `Stayover ⋈ ConsoleMailer` is a valid test composite with no
 * change to either core (ARCHITECTURE.md §9 Law 4).
 */
export interface Mailer {
  send(message: EmailMessage): Promise<SendResult>;
}

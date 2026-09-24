// renderIcs (task 3.2; docs/delivery/ARCHITECTURE.md §4, §7 `renderIcs`): a
// pure function, `CalendarEvent → 𝕊` (RFC 5545 text). No I/O, no clock
// dependency beyond an injectable `now` for `DTSTAMP` (kept out of the
// stability guarantee below — only `UID`/`SEQUENCE` need to be
// byte-identical across calls for the same input, matching design.md
// Decision 3: "same input ⟹ byte-identical UID/SEQUENCE across calls").
//
// RFC 5545 essentials this satisfies (design.md Decision 3, tasks.md 3.2):
//  - CRLF line endings throughout, with line folding at 75 octets (§3.1)
//  - text escaping of `\`, `;`, `,` and newlines (§3.3.11)
//  - one VEVENT with UID, DTSTAMP, SEQUENCE, ORGANIZER, ATTENDEE*, SUMMARY,
//    DTSTART/DTEND as VALUE=DATE
//  - METHOD at the calendar level (REQUEST/CANCEL — RFC 5546)
//  - DTEND exclusive, matching CalendarEvent.span's half-open convention
//    (RFC 5545's own all-day DTEND is already exclusive, so no +1 day
//    adjustment is needed here)

import type { CalendarEvent } from "./types";

const PRODID = "-//Lyanne Visa//Delivery//EN";
const CRLF = "\r\n";
const FOLD_LIMIT_OCTETS = 75;

/** RFC 5545 §3.3.11 TEXT escaping: backslash, semicolon, comma, then newlines to literal `\n`. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * Folds one logical content line to RFC 5545 §3.1's 75-octet limit: any
 * physical line after the first is continued with CRLF + a single leading
 * space (itself counted as an octet against the next 75). Splits on UTF-8
 * octet boundaries, not JS UTF-16 code units, so it never breaks a
 * multi-byte character in half.
 */
function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.byteLength <= FOLD_LIMIT_OCTETS) {
    return line;
  }

  const parts: string[] = [];
  let offset = 0;
  let limit = FOLD_LIMIT_OCTETS;
  while (offset < bytes.byteLength) {
    let end = Math.min(offset + limit, bytes.byteLength);
    // Never split a multi-byte UTF-8 sequence: back off while the next byte
    // is a continuation byte (top two bits `10`).
    while (end < bytes.byteLength && end > offset && (bytes[end] & 0xc0) === 0x80) {
      end -= 1;
    }
    parts.push(bytes.subarray(offset, end).toString("utf8"));
    offset = end;
    // Continuation lines start with one leading space, which itself counts
    // toward that line's own 75-octet budget.
    limit = FOLD_LIMIT_OCTETS - 1;
  }

  return parts.join(CRLF + " ");
}

function formatDateStamp(value: string): string {
  // VALUE=DATE, RFC 5545 §3.3.4: YYYYMMDD.
  return value.replace(/-/g, "");
}

function formatDtstamp(now: Date): string {
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  return (
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T` +
    `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`
  );
}

export interface RenderIcsOptions {
  /** Clock for DTSTAMP; defaults to `new Date()`. Injectable for deterministic tests. */
  now?: Date;
}

/** `renderIcs : CalendarEvent → 𝕊` (RFC 5545, `METHOD:REQUEST`/`METHOD:CANCEL`). */
export function renderIcs(event: CalendarEvent, options: RenderIcsOptions = {}): string {
  const now = options.now ?? new Date();

  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push(`PRODID:${PRODID}`);
  lines.push("CALSCALE:GREGORIAN");
  lines.push(`METHOD:${event.method}`);
  lines.push("BEGIN:VEVENT");
  lines.push(`UID:${escapeText(event.uid)}`);
  lines.push(`DTSTAMP:${formatDtstamp(now)}`);
  lines.push(`SEQUENCE:${event.sequence}`);
  lines.push(`ORGANIZER:mailto:${event.organizer}`);
  for (const attendee of event.attendees) {
    lines.push(`ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=FALSE:mailto:${attendee}`);
  }
  lines.push(`SUMMARY:${escapeText(event.title)}`);
  if (event.location) {
    lines.push(`LOCATION:${escapeText(event.location)}`);
  }
  lines.push(`DTSTART;VALUE=DATE:${formatDateStamp(event.span.start)}`);
  // Exclusive already — CalendarEvent.span mirrors RFC 5545's own all-day
  // DTEND convention (the day AFTER the last included day), so this needs
  // no +1 adjustment.
  lines.push(`DTEND;VALUE=DATE:${formatDateStamp(event.span.end)}`);
  if (event.method === "CANCEL") {
    // RFC 5546 §3.2.5: a CANCEL's VEVENT SHOULD carry STATUS:CANCELLED.
    lines.push("STATUS:CANCELLED");
  }
  lines.push("TRANSP:TRANSPARENT");
  lines.push("END:VEVENT");
  lines.push("END:VCALENDAR");

  return lines.map(foldLine).join(CRLF) + CRLF;
}

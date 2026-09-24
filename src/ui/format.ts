// Pure presentational formatters shared across src/ui screens.
import type { DateRange } from "./types";

/** Formats a whole number of seconds as m:ss for a countdown label, e.g.
 * formatCountdown(45) -> "0:45", formatCountdown(60) -> "1:00",
 * formatCountdown(0) -> "0:00". Negative input is clamped to 0. */
export function formatCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MONTH_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_MS = 86_400_000;

/** Parses an ISO 'YYYY-MM-DD' date string as UTC midnight, so day-math (and
 * the calendar built on it, src/ui/calendar.ts) never drifts across a
 * viewer's local timezone or a DST boundary. */
export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** "Sat 3 Oct" */
export function formatDayMonth(iso: string): string {
  const date = parseISODate(iso);
  return `${WEEKDAY_SHORT[date.getUTCDay()]} ${date.getUTCDate()} ${MONTH_SHORT[date.getUTCMonth()]}`;
}

/** "Sat 3 Oct → Tue 6 Oct" */
export function formatDateRange(range: DateRange): string {
  return `${formatDayMonth(range.start)} → ${formatDayMonth(range.end)}`;
}

/** "October 2026" */
export function formatMonthYear(year: number, month: number): string {
  return `${MONTH_LONG[month - 1]} ${year}`;
}

/** Nights spent = pick-up day minus drop-off day (the pick-up day itself is
 * not a night stayed). Returns the raw (possibly zero/negative) difference
 * so callers — e.g. isValidDateRange — can use it to validate rather than
 * throwing on a malformed range. */
export function nights(range: DateRange): number {
  const start = parseISODate(range.start).getTime();
  const end = parseISODate(range.end).getTime();
  return Math.round((end - start) / DAY_MS);
}

/** "3 nights" / "1 night" */
export function formatNights(count: number): string {
  return `${count} night${count === 1 ? "" : "s"}`;
}

/** A stay's pick-up day must be strictly after its drop-off day (the spec's
 * "invalid date range" scenario). False for missing or unparsable dates. */
export function isValidDateRange(range: DateRange): boolean {
  if (!range.start || !range.end) return false;
  if (Number.isNaN(parseISODate(range.start).getTime())) return false;
  if (Number.isNaN(parseISODate(range.end).getTime())) return false;
  return nights(range) > 0;
}

/** Today's date as an ISO 'YYYY-MM-DD' string, in the viewer's local time.
 * Screens use this as the default for their optional `today` prop. */
export function todayISO(): string {
  return formatISODate(new Date());
}

/** The family's default time zone — used wherever a screen needs a
 * deterministic zone but has no home/viewer-specific one to hand (e.g.
 * AdminDeliveries, or HostHome's initial render before a viewer picks their
 * own). Singapore, where the family is based. */
export const FAMILY_DEFAULT_TIME_ZONE = "Asia/Singapore";

/** "24 Sep 2026, 4:15 pm" — an ISO datetime rendered in a fixed, explicit
 * time zone so server and client render the exact same string (the earlier
 * `new Date(iso).toLocaleString()` bug: the server's locale and the
 * viewer's browser locale can disagree — en-US vs en-GB, 12-hour vs
 * 24-hour — producing a hydration mismatch). Always pass an explicit
 * `timeZone`; callers that have a home to hand use its own zone, everyone
 * else falls back to FAMILY_DEFAULT_TIME_ZONE. Built from Intl's parts
 * (rather than trusting Intl's own month/hour rendering) so the month
 * abbreviation matches MONTH_SHORT's 3-letter style used elsewhere in this
 * file, and midnight reads "12", not some ICU builds' "0". */
export function formatDateTime(iso: string, timeZone: string): string {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);

  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const day = part("day");
  const month = MONTH_SHORT[Number(part("month")) - 1];
  const year = part("year");
  const hourNumber = Number(part("hour"));
  const hour = hourNumber === 0 ? "12" : String(hourNumber);
  const minute = part("minute");
  const period = part("dayPeriod").toLowerCase();

  return `${day} ${month} ${year}, ${hour}:${minute} ${period}`;
}

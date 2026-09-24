// Pure calendar math for the Overview month view (design-reference.md's
// month calendar card). No React — dates are handled through format.ts's
// UTC-safe ISO date parsing, so day-math never drifts across a viewer's
// local timezone or a DST boundary.
import type { DateRange, Phase, Side } from "./types";
import { formatISODate, formatMonthYear, parseISODate } from "./format";
import { needsViewerAnswer } from "./stayStatus";

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type YearMonth = { year: number; month: number }; // month is 1-12

const DAY_MS = 86_400_000;

/** Monday(0)..Sunday(6) index for a UTC date. */
function mondayIndex(date: Date): number {
  return (date.getUTCDay() + 6) % 7;
}

/** Adds (or subtracts) whole months, rolling the year over as needed. */
export function addMonths(yearMonth: YearMonth, delta: number): YearMonth {
  const total = yearMonth.year * 12 + (yearMonth.month - 1) + delta;
  const year = Math.floor(total / 12);
  const month = (((total % 12) + 12) % 12) + 1;
  return { year, month };
}

/** "October 2026" */
export function monthLabel(yearMonth: YearMonth): string {
  return formatMonthYear(yearMonth.year, yearMonth.month);
}

export type MonthCell = { date: string; weekday: number };

/** One flat array of cells, always a multiple of 7 (Monday-first weeks) long
 * enough to cover the whole month; days outside the month are `null` — blank
 * cells, matching design-reference.md's calendar (no adjoining month's day
 * numbers are shown, unlike a typical Sun-Jan-style grid). */
export function buildMonthGrid(yearMonth: YearMonth): (MonthCell | null)[] {
  const first = new Date(Date.UTC(yearMonth.year, yearMonth.month - 1, 1));
  const daysInMonth = new Date(Date.UTC(yearMonth.year, yearMonth.month, 0)).getUTCDate();
  const leading = mondayIndex(first);

  const cells: (MonthCell | null)[] = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(Date.UTC(yearMonth.year, yearMonth.month - 1, day));
    cells.push({ date: formatISODate(date), weekday: mondayIndex(date) });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** Every ISO date from `range.start` to `range.end` inclusive — the pick-up
 * day is part of the stay (design-reference.md's calendar marks it too). */
export function datesInRange(range: DateRange): string[] {
  const start = parseISODate(range.start).getTime();
  const end = parseISODate(range.end).getTime();
  const dates: string[] = [];
  for (let time = start; time <= end; time += DAY_MS) {
    dates.push(formatISODate(new Date(time)));
  }
  return dates;
}

export type CalendarStay = { id: string; dates: DateRange; agreed: boolean };

export type DayState = { stayId: string; agreed: boolean; selected: boolean };

/** Which stay (if any) a given calendar day belongs to: whether it's
 * confirmed/agreed vs. still not-agreed, and whether it's the "currently
 * open" (selected) stay whose days get the accent ring. */
export function dayState(
  date: string,
  stays: CalendarStay[],
  selectedStayId?: string,
): DayState | null {
  const match = stays.find((stay) => datesInRange(stay.dates).includes(date));
  if (!match) return null;
  return { stayId: match.id, agreed: match.agreed, selected: match.id === selectedStayId };
}

export type FeaturedStay = {
  id: string;
  dates: DateRange;
  phase: Phase;
  awaiting?: Side;
  viewerSide: Side;
};

/** Picks the stay Overview's compact brief should feature: the soonest stay
 * needing the viewer's answer; else the soonest still-upcoming confirmed
 * stay; else none. */
export function pickFeaturedStay<T extends FeaturedStay>(
  stays: T[],
  today: string,
): T | undefined {
  const needsAnswer = stays.filter((stay) => needsViewerAnswer(stay));
  if (needsAnswer.length > 0) {
    return [...needsAnswer].sort((a, b) => a.dates.start.localeCompare(b.dates.start))[0];
  }
  const upcoming = stays.filter((stay) => stay.phase === "confirmed" && stay.dates.end >= today);
  if (upcoming.length > 0) {
    return [...upcoming].sort((a, b) => a.dates.start.localeCompare(b.dates.start))[0];
  }
  return undefined;
}

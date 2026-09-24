import { describe, expect, it } from "vitest";
import {
  addMonths,
  buildMonthGrid,
  datesInRange,
  dayState,
  monthLabel,
  pickFeaturedStay,
  WEEKDAY_LABELS,
  type CalendarStay,
} from "./calendar";

function leadingBlanks(cells: ReturnType<typeof buildMonthGrid>): number {
  return cells.findIndex((cell) => cell !== null);
}

function daysInMonth(cells: ReturnType<typeof buildMonthGrid>): number {
  return cells.filter((cell) => cell !== null).length;
}

describe("buildMonthGrid — a month starting on each weekday", () => {
  it("Monday start (April 2024, 30 days)", () => {
    const grid = buildMonthGrid({ year: 2024, month: 4 });
    expect(leadingBlanks(grid)).toBe(0);
    expect(daysInMonth(grid)).toBe(30);
    expect(grid[0]).toEqual({ date: "2024-04-01", weekday: 0 });
  });

  it("Tuesday start (September 2026, 30 days)", () => {
    const grid = buildMonthGrid({ year: 2026, month: 9 });
    expect(leadingBlanks(grid)).toBe(1);
    expect(daysInMonth(grid)).toBe(30);
  });

  it("Wednesday start (February 2023, 28 days, non-leap)", () => {
    const grid = buildMonthGrid({ year: 2023, month: 2 });
    expect(leadingBlanks(grid)).toBe(2);
    expect(daysInMonth(grid)).toBe(28);
  });

  it("Thursday start (October 2026, 31 days — matches design-reference.md's screenshot)", () => {
    const grid = buildMonthGrid({ year: 2026, month: 10 });
    expect(leadingBlanks(grid)).toBe(3);
    expect(daysInMonth(grid)).toBe(31);
    // The screenshot shows Sat 3/Sun 4 in the first row and Mon 5/Tue 6 in
    // the second — confirms Monday-first, blank-leading layout.
    expect(grid.slice(0, 7).map((cell) => cell?.date ?? null)).toEqual([
      null, null, null, "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04",
    ]);
  });

  it("Friday start (May 2026, 31 days)", () => {
    const grid = buildMonthGrid({ year: 2026, month: 5 });
    expect(leadingBlanks(grid)).toBe(4);
    expect(daysInMonth(grid)).toBe(31);
  });

  it("Saturday start (August 2026, 31 days)", () => {
    const grid = buildMonthGrid({ year: 2026, month: 8 });
    expect(leadingBlanks(grid)).toBe(5);
    expect(daysInMonth(grid)).toBe(31);
  });

  it("Sunday start (November 2026, 30 days)", () => {
    const grid = buildMonthGrid({ year: 2026, month: 11 });
    expect(leadingBlanks(grid)).toBe(6);
    expect(daysInMonth(grid)).toBe(30);
  });

  it("leap February (2024, 29 days, Thursday start)", () => {
    const grid = buildMonthGrid({ year: 2024, month: 2 });
    expect(leadingBlanks(grid)).toBe(3);
    expect(daysInMonth(grid)).toBe(29);
    expect(grid.filter((cell) => cell !== null).at(-1)).toEqual({
      date: "2024-02-29",
      weekday: 3,
    });
  });

  it("always returns a whole number of Monday-first weeks", () => {
    for (let month = 1; month <= 12; month++) {
      const grid = buildMonthGrid({ year: 2026, month });
      expect(grid.length % 7).toBe(0);
    }
  });
});

describe("monthLabel", () => {
  it("formats as 'Month YYYY'", () => {
    expect(monthLabel({ year: 2026, month: 10 })).toBe("October 2026");
  });
});

describe("addMonths", () => {
  it("advances within a year", () => {
    expect(addMonths({ year: 2026, month: 10 }, 1)).toEqual({ year: 2026, month: 11 });
  });

  it("rolls over into the next year", () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
  });

  it("rolls back into the previous year", () => {
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });

  it("handles multi-year jumps", () => {
    expect(addMonths({ year: 2026, month: 6 }, -18)).toEqual({ year: 2024, month: 12 });
  });
});

describe("datesInRange", () => {
  it("includes the pick-up day as part of the stay", () => {
    expect(datesInRange({ start: "2026-10-03", end: "2026-10-06" })).toEqual([
      "2026-10-03",
      "2026-10-04",
      "2026-10-05",
      "2026-10-06",
    ]);
  });

  it("returns a single day for a same-day (degenerate) range", () => {
    expect(datesInRange({ start: "2026-10-03", end: "2026-10-03" })).toEqual(["2026-10-03"]);
  });

  it("spans a month boundary", () => {
    expect(datesInRange({ start: "2026-10-30", end: "2026-11-02" })).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });

  it("spans a leap-day February boundary", () => {
    expect(datesInRange({ start: "2024-02-27", end: "2024-03-01" })).toEqual([
      "2024-02-27",
      "2024-02-28",
      "2024-02-29",
      "2024-03-01",
    ]);
  });
});

describe("dayState", () => {
  const stays: CalendarStay[] = [
    { id: "confirmed-stay", dates: { start: "2026-10-10", end: "2026-10-12" }, agreed: true },
    { id: "open-stay", dates: { start: "2026-10-03", end: "2026-10-06" }, agreed: false },
  ];

  it("returns null for a day with no stay", () => {
    expect(dayState("2026-10-01", stays)).toBeNull();
  });

  it("marks a confirmed stay's days as agreed", () => {
    expect(dayState("2026-10-11", stays)).toEqual({
      stayId: "confirmed-stay",
      agreed: true,
      selected: false,
    });
  });

  it("marks a not-yet-agreed stay's days as not agreed", () => {
    expect(dayState("2026-10-04", stays)).toEqual({
      stayId: "open-stay",
      agreed: false,
      selected: false,
    });
  });

  it("marks the pick-up day as part of the stay too", () => {
    expect(dayState("2026-10-06", stays)?.stayId).toBe("open-stay");
  });

  it("flags the currently-open stay's days as selected", () => {
    expect(dayState("2026-10-04", stays, "open-stay")).toEqual({
      stayId: "open-stay",
      agreed: false,
      selected: true,
    });
  });

  it("does not flag a different stay's days as selected", () => {
    expect(dayState("2026-10-11", stays, "open-stay")?.selected).toBe(false);
  });
});

describe("pickFeaturedStay", () => {
  type Stay = { id: string; dates: { start: string; end: string }; phase: "negotiating" | "confirmed" | "declined" | "cancelled"; awaiting?: "parent" | "host"; viewerSide: "parent" | "host" };

  it("returns undefined when there are no stays", () => {
    expect(pickFeaturedStay([] as Stay[], "2026-10-01")).toBeUndefined();
  });

  it("prefers the soonest stay needing the viewer's answer", () => {
    const stays: Stay[] = [
      { id: "later", dates: { start: "2026-11-01", end: "2026-11-03" }, phase: "negotiating", awaiting: "parent", viewerSide: "parent" },
      { id: "sooner", dates: { start: "2026-10-03", end: "2026-10-06" }, phase: "negotiating", awaiting: "parent", viewerSide: "parent" },
    ];
    expect(pickFeaturedStay(stays, "2026-10-01")?.id).toBe("sooner");
  });

  it("falls back to the soonest upcoming confirmed stay when nothing needs an answer", () => {
    const stays: Stay[] = [
      { id: "waiting-on-host", dates: { start: "2026-10-03", end: "2026-10-06" }, phase: "negotiating", awaiting: "host", viewerSide: "parent" },
      { id: "confirmed", dates: { start: "2026-11-01", end: "2026-11-03" }, phase: "confirmed", viewerSide: "parent" },
    ];
    expect(pickFeaturedStay(stays, "2026-10-01")?.id).toBe("confirmed");
  });

  it("ignores a confirmed stay that has already ended", () => {
    const stays: Stay[] = [
      { id: "past", dates: { start: "2026-09-01", end: "2026-09-03" }, phase: "confirmed", viewerSide: "parent" },
    ];
    expect(pickFeaturedStay(stays, "2026-10-01")).toBeUndefined();
  });

  it("ignores declined and cancelled stays entirely", () => {
    const stays: Stay[] = [
      { id: "declined", dates: { start: "2026-11-01", end: "2026-11-03" }, phase: "declined", viewerSide: "parent" },
      { id: "cancelled", dates: { start: "2026-11-05", end: "2026-11-07" }, phase: "cancelled", viewerSide: "parent" },
    ];
    expect(pickFeaturedStay(stays, "2026-10-01")).toBeUndefined();
  });
});

describe("WEEKDAY_LABELS", () => {
  it("is Monday-first, matching design-reference.md's calendar header", () => {
    expect(WEEKDAY_LABELS).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  });
});

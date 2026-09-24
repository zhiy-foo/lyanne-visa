import { describe, expect, it } from "vitest";
import {
  formatCountdown,
  formatDateRange,
  formatDayMonth,
  formatMonthYear,
  formatNights,
  isValidDateRange,
  nights,
  parseISODate,
} from "./format";

describe("formatCountdown", () => {
  it("formats seconds under a minute as 0:ss", () => {
    expect(formatCountdown(45)).toBe("0:45");
    expect(formatCountdown(9)).toBe("0:09");
  });

  it("formats a full minute as 1:00", () => {
    expect(formatCountdown(60)).toBe("1:00");
  });

  it("formats zero as 0:00", () => {
    expect(formatCountdown(0)).toBe("0:00");
  });

  it("formats more than a minute as m:ss", () => {
    expect(formatCountdown(125)).toBe("2:05");
  });

  it("truncates fractional seconds", () => {
    expect(formatCountdown(45.9)).toBe("0:45");
  });

  it("clamps negative input to 0:00", () => {
    expect(formatCountdown(-5)).toBe("0:00");
  });
});

describe("parseISODate", () => {
  it("parses as UTC midnight, immune to local timezone", () => {
    const date = parseISODate("2026-10-03");
    expect(date.getUTCFullYear()).toBe(2026);
    expect(date.getUTCMonth()).toBe(9); // 0-indexed
    expect(date.getUTCDate()).toBe(3);
  });
});

describe("formatDayMonth", () => {
  it("formats as 'Weekday D Mon'", () => {
    expect(formatDayMonth("2026-10-03")).toBe("Sat 3 Oct");
  });

  it("does not zero-pad the day", () => {
    expect(formatDayMonth("2026-10-06")).toBe("Tue 6 Oct");
  });
});

describe("formatDateRange", () => {
  it("formats 'Sat 3 Oct → Tue 6 Oct'", () => {
    expect(formatDateRange({ start: "2026-10-03", end: "2026-10-06" })).toBe("Sat 3 Oct → Tue 6 Oct");
  });
});

describe("formatMonthYear", () => {
  it("formats 'October 2026'", () => {
    expect(formatMonthYear(2026, 10)).toBe("October 2026");
  });
});

describe("nights", () => {
  it("counts nights as the day difference (pick-up day is not a night)", () => {
    expect(nights({ start: "2026-10-03", end: "2026-10-06" })).toBe(3);
  });

  it("is zero for a same-day range", () => {
    expect(nights({ start: "2026-10-03", end: "2026-10-03" })).toBe(0);
  });

  it("is negative when the pick-up day is before the drop-off day", () => {
    expect(nights({ start: "2026-10-06", end: "2026-10-03" })).toBe(-3);
  });

  it("spans a month boundary correctly", () => {
    expect(nights({ start: "2026-10-30", end: "2026-11-02" })).toBe(3);
  });
});

describe("formatNights", () => {
  it("pluralises correctly", () => {
    expect(formatNights(0)).toBe("0 nights");
    expect(formatNights(1)).toBe("1 night");
    expect(formatNights(3)).toBe("3 nights");
  });
});

describe("isValidDateRange", () => {
  it("accepts a pick-up day after the drop-off day", () => {
    expect(isValidDateRange({ start: "2026-10-03", end: "2026-10-06" })).toBe(true);
  });

  it("rejects a pick-up day on the same day as drop-off", () => {
    expect(isValidDateRange({ start: "2026-10-03", end: "2026-10-03" })).toBe(false);
  });

  it("rejects a pick-up day before the drop-off day", () => {
    expect(isValidDateRange({ start: "2026-10-06", end: "2026-10-03" })).toBe(false);
  });

  it("rejects a missing start date", () => {
    expect(isValidDateRange({ start: "", end: "2026-10-06" })).toBe(false);
  });

  it("rejects a missing end date", () => {
    expect(isValidDateRange({ start: "2026-10-03", end: "" })).toBe(false);
  });

  it("rejects both dates missing", () => {
    expect(isValidDateRange({ start: "", end: "" })).toBe(false);
  });
});

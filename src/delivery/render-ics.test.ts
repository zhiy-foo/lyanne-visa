import { describe, expect, it } from "vitest";
import { renderIcs } from "./render-ics";
import type { CalendarEvent } from "./types";

/** Task 3.2: renderIcs unit tests (design.md Decision 3, tasks.md 3.2). */

const baseEvent: CalendarEvent = {
  uid: "app-123@lyanne-visa",
  sequence: 1,
  method: "REQUEST",
  span: { start: "2026-10-03", end: "2026-10-06" },
  title: "Lyanne at Grandma & Grandpa's",
  organizer: "lyanne.stayovers@gmail.com",
  attendees: ["parent@example.com", "host@example.com"],
};

/** Splits rendered text into logical (unfolded) lines for easier assertions. */
function unfold(ics: string): string[] {
  return ics
    .replace(/\r\n /g, "") // undo folding: CRLF + leading space rejoins the line
    .split("\r\n")
    .filter((line) => line.length > 0);
}

describe("renderIcs", () => {
  it("uses CRLF line endings throughout", () => {
    const ics = renderIcs(baseEvent, { now: new Date("2026-09-24T12:00:00Z") });
    expect(ics.includes("\r\n")).toBe(true);
    // No bare \n without a preceding \r.
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("has the required calendar-level components", () => {
    const lines = unfold(renderIcs(baseEvent, { now: new Date("2026-09-24T12:00:00Z") }));
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("VERSION:2.0");
    expect(lines.some((l) => l.startsWith("PRODID:"))).toBe(true);
    expect(lines).toContain("METHOD:REQUEST");
    expect(lines[lines.length - 1]).toBe("END:VCALENDAR");
  });

  it("has exactly one VEVENT with UID, DTSTAMP, SEQUENCE, ORGANIZER, ATTENDEE*, SUMMARY, DTSTART/DTEND as VALUE=DATE", () => {
    const lines = unfold(renderIcs(baseEvent, { now: new Date("2026-09-24T12:00:00Z") }));

    expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(1);
    expect(lines.filter((l) => l === "END:VEVENT")).toHaveLength(1);

    expect(lines).toContain("UID:app-123@lyanne-visa");
    expect(lines.some((l) => /^DTSTAMP:\d{8}T\d{6}Z$/.test(l))).toBe(true);
    expect(lines).toContain("SEQUENCE:1");
    expect(lines).toContain("ORGANIZER:mailto:lyanne.stayovers@gmail.com");

    const attendeeLines = lines.filter((l) => l.startsWith("ATTENDEE"));
    expect(attendeeLines).toHaveLength(2);
    expect(attendeeLines.some((l) => l.endsWith(":mailto:parent@example.com"))).toBe(true);
    expect(attendeeLines.some((l) => l.endsWith(":mailto:host@example.com"))).toBe(true);

    expect(lines.some((l) => l.startsWith("SUMMARY:"))).toBe(true);
    expect(lines).toContain("DTSTART;VALUE=DATE:20261003");
    expect(lines).toContain("DTEND;VALUE=DATE:20261006");
  });

  it("DTEND is exclusive — matches span.end verbatim, no +1 day adjustment", () => {
    const event: CalendarEvent = { ...baseEvent, span: { start: "2026-12-24", end: "2026-12-25" } };
    const lines = unfold(renderIcs(event, { now: new Date("2026-09-24T12:00:00Z") }));
    expect(lines).toContain("DTSTART;VALUE=DATE:20261224");
    expect(lines).toContain("DTEND;VALUE=DATE:20261225");
  });

  it("REQUEST method: no STATUS:CANCELLED line", () => {
    const lines = unfold(renderIcs(baseEvent, { now: new Date("2026-09-24T12:00:00Z") }));
    expect(lines).not.toContain("STATUS:CANCELLED");
  });

  it("CANCEL method: METHOD:CANCEL at calendar level, and STATUS:CANCELLED on the VEVENT", () => {
    const event: CalendarEvent = { ...baseEvent, method: "CANCEL" };
    const lines = unfold(renderIcs(event, { now: new Date("2026-09-24T12:00:00Z") }));
    expect(lines).toContain("METHOD:CANCEL");
    expect(lines).toContain("STATUS:CANCELLED");
  });

  it("includes LOCATION when present, omits it when absent", () => {
    const withLocation: CalendarEvent = { ...baseEvent, location: "1 Example St" };
    const withLocationLines = unfold(renderIcs(withLocation, { now: new Date("2026-09-24T12:00:00Z") }));
    expect(withLocationLines).toContain("LOCATION:1 Example St");

    const withoutLocationLines = unfold(renderIcs(baseEvent, { now: new Date("2026-09-24T12:00:00Z") }));
    expect(withoutLocationLines.some((l) => l.startsWith("LOCATION"))).toBe(false);
  });

  it("escapes commas, semicolons, backslashes and newlines in text fields", () => {
    const event: CalendarEvent = {
      ...baseEvent,
      title: "Weekend at Grandma's; bring a coat, and a\\toy\nplus a blanket",
    };
    const ics = renderIcs(event, { now: new Date("2026-09-24T12:00:00Z") });
    // Verify inside the raw (unfolded) text: escape sequences must be there
    // verbatim in whichever physical line SUMMARY ends up on.
    const joined = ics.replace(/\r\n /g, "");
    expect(joined).toContain(
      "SUMMARY:Weekend at Grandma's\\; bring a coat\\, and a\\\\toy\\nplus a blanket",
    );
  });

  it("folds a long line at 75 octets, continuation lines start with a single space", () => {
    const event: CalendarEvent = {
      ...baseEvent,
      title: "A".repeat(200), // forces SUMMARY well past 75 octets
    };
    const ics = renderIcs(event, { now: new Date("2026-09-24T12:00:00Z") });
    const physicalLines = ics.split("\r\n").filter((l) => l.length > 0);

    // Every physical line must be at most 75 octets.
    for (const line of physicalLines) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    }

    // At least one continuation line (starting with a single space) exists.
    expect(physicalLines.some((l) => l.startsWith(" "))).toBe(true);

    // Unfolding reconstitutes the full 200-character SUMMARY.
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain(`SUMMARY:${"A".repeat(200)}`);
  });

  it("folds correctly around multi-byte UTF-8 characters without splitting one in half", () => {
    // Each "café" emoji-free multi-byte char (é = 2 bytes in UTF-8) repeated
    // enough times to force folding well past a single 75-octet line.
    const event: CalendarEvent = { ...baseEvent, title: "café ".repeat(30) };
    const ics = renderIcs(event, { now: new Date("2026-09-24T12:00:00Z") });
    const physicalLines = ics.split("\r\n").filter((l) => l.length > 0);

    for (const line of physicalLines) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
      // Round-tripping through Buffer must not produce the replacement
      // character — proof no multi-byte sequence was split mid-character.
      expect(line).not.toContain("�");
    }

    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain(`SUMMARY:${"café ".repeat(30)}`);
  });

  it("stability: same input produces byte-identical UID and SEQUENCE across calls, regardless of DTSTAMP clock", () => {
    const first = renderIcs(baseEvent, { now: new Date("2026-01-01T00:00:00Z") });
    const second = renderIcs(baseEvent, { now: new Date("2099-12-31T23:59:59Z") });

    const uidFrom = (ics: string) => ics.match(/UID:([^\r\n]*)\r\n/)?.[1];
    const seqFrom = (ics: string) => ics.match(/SEQUENCE:([^\r\n]*)\r\n/)?.[1];

    expect(uidFrom(first)).toBe(uidFrom(second));
    expect(uidFrom(first)).toBe(baseEvent.uid);
    expect(seqFrom(first)).toBe(seqFrom(second));
    expect(seqFrom(first)).toBe(String(baseEvent.sequence));
  });

  it("stability: identical input renders byte-identical output when DTSTAMP is pinned too", () => {
    const now = new Date("2026-09-24T12:00:00Z");
    const first = renderIcs(baseEvent, { now });
    const second = renderIcs({ ...baseEvent }, { now });
    expect(first).toBe(second);
  });

  it("a higher SEQUENCE renders a different SEQUENCE line (monotone across revisions)", () => {
    const rev1 = renderIcs({ ...baseEvent, sequence: 1 }, { now: new Date("2026-09-24T12:00:00Z") });
    const rev2 = renderIcs({ ...baseEvent, sequence: 2 }, { now: new Date("2026-09-24T12:00:00Z") });
    expect(rev1).toContain("SEQUENCE:1");
    expect(rev2).toContain("SEQUENCE:2");
    expect(rev1).not.toBe(rev2);
  });

  it("no attendees still renders a valid single VEVENT (edge case: empty participants)", () => {
    const event: CalendarEvent = { ...baseEvent, attendees: [] };
    const lines = unfold(renderIcs(event, { now: new Date("2026-09-24T12:00:00Z") }));
    expect(lines.filter((l) => l.startsWith("ATTENDEE"))).toHaveLength(0);
    expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(1);
  });
});

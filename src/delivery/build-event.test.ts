import { describe, expect, it } from "vitest";
import { buildEvent } from "./build-event";
import type { CalendarFacts } from "./build-event";

function facts(overrides: Partial<CalendarFacts> = {}): CalendarFacts {
  return {
    applicationId: "app-123",
    agreed: { start: "2026-10-03", end: "2026-10-07" },
    revision: 1,
    phase: "confirmed",
    placeTimeZone: "Asia/Singapore",
    placeAddress: "1 Grandparent Way",
    childName: "Lyanne",
    placeName: "Grandma & Grandpa's",
    attendees: ["mum@example.com", "grandma@example.com"],
    organizer: "app@lyanne-visa.example",
    ...overrides,
  };
}

describe("buildEvent", () => {
  it("deduces ev_uid stably from the application id", () => {
    const event = buildEvent(facts());
    expect(event.uid).toBe("app-123@lyanne-visa");
    // Stable across calls with the same input.
    expect(buildEvent(facts()).uid).toBe(event.uid);
  });

  it("ev_sequence equals revision", () => {
    expect(buildEvent(facts({ revision: 0 })).sequence).toBe(0);
    expect(buildEvent(facts({ revision: 5 })).sequence).toBe(5);
  });

  it("ev_method is REQUEST for a confirmed/negotiating/rejected phase", () => {
    expect(buildEvent(facts({ phase: "confirmed" })).method).toBe("REQUEST");
    expect(buildEvent(facts({ phase: "negotiating" })).method).toBe("REQUEST");
  });

  it("ev_method is CANCEL iff phase = cancelled", () => {
    expect(buildEvent(facts({ phase: "cancelled" })).method).toBe("CANCEL");
  });

  it("ev_span covers drop-off through pick-up day inclusive, ending with day after pick-up", () => {
    const event = buildEvent(facts({ agreed: { start: "2026-11-01", end: "2026-11-04" } }));
    // Agreed 2026-11-01 (drop-off) through 2026-11-04 (pick-up)
    // → span ends on 2026-11-05 (day after pick-up, exclusive)
    expect(event.span).toEqual({ start: "2026-11-01", end: "2026-11-05" });
  });

  it("ev_span handles month rollover correctly", () => {
    const event = buildEvent(facts({ agreed: { start: "2026-09-28", end: "2026-09-30" } }));
    // Agreed 2026-09-28 → 2026-09-30 → span end = 2026-10-01
    expect(event.span).toEqual({ start: "2026-09-28", end: "2026-10-01" });
  });

  it("ev_span handles year rollover correctly", () => {
    const event = buildEvent(facts({ agreed: { start: "2026-12-30", end: "2026-12-31" } }));
    // Agreed 2026-12-30 → 2026-12-31 → span end = 2027-01-01
    expect(event.span).toEqual({ start: "2026-12-30", end: "2027-01-01" });
  });

  it("ev_title names the child and the place", () => {
    expect(buildEvent(facts()).title).toBe("Lyanne at Grandma & Grandpa's");
  });

  it("ev_location? is the place's address when present, undefined when not", () => {
    expect(buildEvent(facts()).location).toBe("1 Grandparent Way");
    expect(buildEvent(facts({ placeAddress: undefined })).location).toBeUndefined();
  });

  it("ev_organizer is the given sending address", () => {
    expect(buildEvent(facts()).organizer).toBe("app@lyanne-visa.example");
  });

  it("ev_attendees are the given participant emails", () => {
    expect(buildEvent(facts()).attendees).toEqual(["mum@example.com", "grandma@example.com"]);
  });
});

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

  it("ev_span is the agreed date range, all-day, half-open", () => {
    const event = buildEvent(facts({ agreed: { start: "2026-11-01", end: "2026-11-04" } }));
    expect(event.span).toEqual({ start: "2026-11-01", end: "2026-11-04" });
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

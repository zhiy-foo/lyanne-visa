import { describe, expect, it } from "vitest";
import { renderInvite } from "./render-invite";
import type { CalendarEvent } from "./types";

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    uid: "app-1@lyanne-visa",
    sequence: 1,
    method: "REQUEST",
    span: { start: "2026-10-03", end: "2026-10-07" },
    title: "Lyanne at Grandma & Grandpa's",
    location: "1 Grandparent Way",
    organizer: "app@lyanne-visa.example",
    attendees: ["mum@example.com", "grandma@example.com"],
    ...overrides,
  };
}

describe("renderInvite", () => {
  it("subject is 'Confirmed:' for the first revision", () => {
    const message = renderInvite({ to: "mum@example.com", childName: "Lyanne", placeName: "Grandma's", event: event({ sequence: 1 }) });
    expect(message.subject).toMatch(/^Confirmed:/);
  });

  it("subject is 'Updated:' for a later revision", () => {
    const message = renderInvite({ to: "mum@example.com", childName: "Lyanne", placeName: "Grandma's", event: event({ sequence: 2 }) });
    expect(message.subject).toMatch(/^Updated:/);
  });

  it("subject is 'Cancelled:' for a CANCEL method", () => {
    const message = renderInvite({
      to: "mum@example.com",
      childName: "Lyanne",
      placeName: "Grandma's",
      event: event({ method: "CANCEL" }),
    });
    expect(message.subject).toMatch(/^Cancelled:/);
    expect(message.text).toContain("cancelled");
  });

  it("attaches the rendered .ics with the matching method", () => {
    const message = renderInvite({ to: "mum@example.com", childName: "Lyanne", placeName: "Grandma's", event: event() });
    expect(message.icsAttachment?.method).toBe("REQUEST");
    expect(message.icsAttachment?.content).toContain("METHOD:REQUEST");
    expect(message.icsAttachment?.content).toContain("UID:app-1@lyanne-visa");
  });

  it("every fact in the html body also appears in the plain text", () => {
    const message = renderInvite({ to: "mum@example.com", childName: "Lyanne", placeName: "Grandma's", event: event() });
    expect(message.text).toContain("2026-10-03");
    expect(message.text).toContain("1 Grandparent Way");
  });
});

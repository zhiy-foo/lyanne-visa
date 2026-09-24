import { describe, expect, it } from "vitest";
import { renderDispatch } from "./dispatch-render";
import type { DispatchRow } from "./send-pending-dispatches";

function row(overrides: Partial<DispatchRow> = {}): DispatchRow {
  return {
    id: "d1",
    memberId: "m1",
    applicationId: "app-1",
    toEmail: "grandma@example.com",
    kind: "notice",
    revision: 0,
    status: "pending",
    attempts: 0,
    lastError: null,
    claimedAt: null,
    createdAt: "2026-09-24T00:00:00.000Z",
    updatedAt: "2026-09-24T00:00:00.000Z",
    payload: {},
    ...overrides,
  };
}

const options = { organizer: "app@lyanne-visa.example", appUrl: "https://lyanne-visa.example" };

describe("renderDispatch", () => {
  it("renders a notice dispatch via renderNotice, using the payload's snapshot", () => {
    const message = renderDispatch(
      row({
        kind: "notice",
        payload: {
          notice_kind: "propose",
          child_name: "Lyanne",
          place_name: "Grandma's",
          mover_name: "Mum",
          mover_side: "parent",
          date_start: "2026-10-03",
          date_end: "2026-10-07",
          application_id: "app-1",
        },
      }),
      options,
    );
    expect(message.to).toBe("grandma@example.com");
    expect(message.subject).toContain("Mum");
    expect(message.text).toContain("Lyanne");
  });

  it("renders an invite dispatch via buildEvent + renderIcs + renderInvite", () => {
    const message = renderDispatch(
      row({
        kind: "invite",
        revision: 1,
        payload: {
          method: "REQUEST",
          application_id: "app-1",
          child_name: "Lyanne",
          place_name: "Grandma's",
          place_address: "1 Grandparent Way",
          time_zone: "Asia/Singapore",
          date_start: "2026-10-03",
          date_end: "2026-10-07",
          attendees: ["mum@example.com", "grandma@example.com"],
        },
      }),
      options,
    );
    expect(message.subject).toMatch(/^Confirmed:/);
    expect(message.icsAttachment?.method).toBe("REQUEST");
    expect(message.icsAttachment?.content).toContain("UID:app-1@lyanne-visa");
    expect(message.icsAttachment?.content).toContain("ORGANIZER:mailto:app@lyanne-visa.example");
  });

  it("renders a CANCEL invite dispatch with STATUS:CANCELLED in the ics", () => {
    const message = renderDispatch(
      row({
        kind: "invite",
        revision: 2,
        payload: {
          method: "CANCEL",
          application_id: "app-1",
          child_name: "Lyanne",
          place_name: "Grandma's",
          time_zone: "Asia/Singapore",
          date_start: "2026-10-03",
          date_end: "2026-10-07",
          attendees: ["mum@example.com"],
        },
      }),
      options,
    );
    expect(message.subject).toMatch(/^Cancelled:/);
    expect(message.icsAttachment?.content).toContain("STATUS:CANCELLED");
  });

  it("throws (a render failure, recorded by the send loop) when an invite payload is missing required facts", () => {
    expect(() => renderDispatch(row({ kind: "invite", payload: {} }), options)).toThrow();
  });
});

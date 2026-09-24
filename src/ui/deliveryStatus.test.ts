import { describe, expect, it } from "vitest";
import { formatInviteStatus } from "./deliveryStatus";

describe("formatInviteStatus", () => {
  it("reads naturally for exactly 1 of 1", () => {
    expect(formatInviteStatus(1, 1)).toBe("Calendar invite sent to 1 of 1 person.");
  });

  it("pluralises for more than one recipient", () => {
    expect(formatInviteStatus(2, 3)).toBe("Calendar invites sent to 2 of 3 people.");
  });

  it("pluralises when none have sent yet", () => {
    expect(formatInviteStatus(0, 2)).toBe("Calendar invites sent to 0 of 2 people.");
  });

  it("stays singular for 0 of 1 — one recipient in total, none sent yet", () => {
    expect(formatInviteStatus(0, 1)).toBe("Calendar invite sent to 0 of 1 person.");
  });
});

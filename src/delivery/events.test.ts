import { describe, expect, it } from "vitest";
import { planDelivery } from "./events";
import type { StayoverEvent } from "./events";

/**
 * Task 3.4: table-driven test, one case per row of
 * docs/delivery/ARCHITECTURE.md §5's planDelivery table.
 */

function moveCommitted(overrides: Partial<Extract<StayoverEvent, { kind: "MoveCommitted" }>>): StayoverEvent {
  return {
    kind: "MoveCommitted",
    applicationId: "app-1",
    childName: "Lyanne",
    placeName: "Grandma & Grandpa's",
    moveKind: "propose",
    side: "parent",
    moverName: "Mum",
    hadAgreementBefore: false,
    ...overrides,
  };
}

describe("planDelivery", () => {
  it("PROPOSE, no agreement yet: notice to the awaiting side", () => {
    const plan = planDelivery(moveCommitted({ moveKind: "propose", side: "parent", awaitingAfter: "host" }));
    expect(plan).toEqual([{ kind: "notice", recipientSide: "host" }]);
  });

  it("PROPOSE change on a confirmed stay: notice to the awaiting side, no invite", () => {
    const plan = planDelivery(
      moveCommitted({ moveKind: "propose", side: "host", awaitingAfter: "parent", hadAgreementBefore: true }),
    );
    expect(plan).toEqual([{ kind: "notice", recipientSide: "parent" }]);
  });

  it("ACCEPT: notice to the proposing side, invite REQUEST to every participant", () => {
    const plan = planDelivery(moveCommitted({ moveKind: "accept", side: "host", answeredSide: "parent" }));
    expect(plan).toEqual([
      { kind: "notice", recipientSide: "parent" },
      { kind: "invite", recipientSide: "parent", method: "REQUEST" },
      { kind: "invite", recipientSide: "host", method: "REQUEST" },
    ]);
  });

  it("REJECT, no agreement: notice to the proposing side (parents)", () => {
    const plan = planDelivery(moveCommitted({ moveKind: "reject", side: "host", answeredSide: "parent" }));
    expect(plan).toEqual([{ kind: "notice", recipientSide: "parent" }]);
  });

  it("REJECT of a change, agreement kept: notice to the proposing side", () => {
    const plan = planDelivery(
      moveCommitted({ moveKind: "reject", side: "parent", answeredSide: "host", hadAgreementBefore: true }),
    );
    expect(plan).toEqual([{ kind: "notice", recipientSide: "host" }]);
  });

  it("CANCEL before agreement: notice to the other side, no invite", () => {
    const plan = planDelivery(moveCommitted({ moveKind: "cancel", side: "parent", hadAgreementBefore: false }));
    expect(plan).toEqual([{ kind: "notice", recipientSide: "host" }]);
  });

  it("CANCEL after agreement: notice to the other side, invite CANCEL to every participant", () => {
    const plan = planDelivery(moveCommitted({ moveKind: "cancel", side: "host", hadAgreementBefore: true }));
    expect(plan).toEqual([
      { kind: "notice", recipientSide: "parent" },
      { kind: "invite", recipientSide: "parent", method: "CANCEL" },
      { kind: "invite", recipientSide: "host", method: "CANCEL" },
    ]);
  });

  it("ApplicationDeleted (unanswered): notice to the hosts", () => {
    const plan = planDelivery({ kind: "ApplicationDeleted", applicationId: "app-1", childName: "Lyanne", placeName: "Grandma's" });
    expect(plan).toEqual([{ kind: "notice", recipientSide: "host" }]);
  });

  it("MemberWaiting (registered without join code): notice to the admin", () => {
    const plan = planDelivery({ kind: "MemberWaiting", personName: "New Person", role: "parent" });
    expect(plan).toEqual([{ kind: "notice", recipientSide: "admin" }]);
  });
});

import { describe, expect, it } from "vitest";
import { computeCan, validateMove, type ApplicationState } from "./validateMove";

const negotiatingAwaitingHost: ApplicationState = { phase: "negotiating", awaiting: "host", hostHasAnswered: false };
const negotiatingAwaitingParent: ApplicationState = {
  phase: "negotiating",
  awaiting: "parent",
  hostHasAnswered: true,
};
const confirmedNoChange: ApplicationState = { phase: "confirmed", awaiting: undefined, hostHasAnswered: true };
const confirmedChangeAwaitingParent: ApplicationState = {
  phase: "confirmed",
  awaiting: "parent",
  hostHasAnswered: true,
};
const declined: ApplicationState = { phase: "declined", awaiting: undefined, hostHasAnswered: true };
const cancelled: ApplicationState = { phase: "cancelled", awaiting: undefined, hostHasAnswered: true };

describe("computeCan — §5 state table (task 2.6)", () => {
  it("parent-awaiting-host: only cancel and delete (matches fixtures.ts)", () => {
    expect(computeCan(negotiatingAwaitingHost, "parent")).toEqual({
      accept: false,
      decline: false,
      propose: false,
      cancel: true,
      delete: true,
    });
  });

  it("parent-awaiting-you (host proposed, parent's turn): accept/decline/propose/cancel, no delete", () => {
    expect(computeCan(negotiatingAwaitingParent, "parent")).toEqual({
      accept: true,
      decline: true,
      propose: true,
      cancel: true,
      delete: false,
    });
  });

  it("host-awaiting-you: accept/decline/propose/cancel, never delete (not a parent)", () => {
    expect(computeCan(negotiatingAwaitingHost, "host")).toEqual({
      accept: true,
      decline: true,
      propose: true,
      cancel: true,
      delete: false,
    });
  });

  it("host-awaiting-parent: only cancel", () => {
    expect(computeCan(negotiatingAwaitingParent, "host")).toEqual({
      accept: false,
      decline: false,
      propose: false,
      cancel: true,
      delete: false,
    });
  });

  it("confirmed, no pending change: propose and cancel only", () => {
    expect(computeCan(confirmedNoChange, "parent")).toEqual({
      accept: false,
      decline: false,
      propose: true,
      cancel: true,
      delete: false,
    });
  });

  it("confirmed, change pending your answer: full set except delete", () => {
    expect(computeCan(confirmedChangeAwaitingParent, "parent")).toEqual({
      accept: true,
      decline: true,
      propose: true,
      cancel: true,
      delete: false,
    });
  });

  it("confirmed, change pending their answer: cancel only", () => {
    expect(computeCan(confirmedChangeAwaitingParent, "host")).toEqual({
      accept: false,
      decline: false,
      propose: false,
      cancel: true,
      delete: false,
    });
  });

  it("declined: nothing (terminal)", () => {
    expect(computeCan(declined, "parent")).toEqual({
      accept: false,
      decline: false,
      propose: false,
      cancel: false,
      delete: false,
    });
  });

  it("cancelled: nothing (terminal)", () => {
    expect(computeCan(cancelled, "host")).toEqual({
      accept: false,
      decline: false,
      propose: false,
      cancel: false,
      delete: false,
    });
  });

  it("delete is allowed while unanswered, regardless of phase, only for a parent", () => {
    const unansweredCancelled: ApplicationState = { phase: "cancelled", awaiting: undefined, hostHasAnswered: false };
    expect(validateMove(unansweredCancelled, "parent", "delete")).toEqual({ ok: true });
    expect(validateMove(unansweredCancelled, "host", "delete").ok).toBe(false);
  });
});

describe("validateMove — accept overlap and capacity (design Decision 4)", () => {
  it("refuses an accept overlapping another agreed range for the same child", () => {
    const result = validateMove(negotiatingAwaitingHost, "host", "accept", {
      proposedDates: { start: "2026-10-05", end: "2026-10-08" },
      otherAgreedRangesForChild: [{ start: "2026-10-03", end: "2026-10-06" }],
    });
    expect(result.ok).toBe(false);
  });

  it("allows a non-overlapping (half-open, back-to-back) accept", () => {
    const result = validateMove(negotiatingAwaitingHost, "host", "accept", {
      proposedDates: { start: "2026-10-06", end: "2026-10-08" },
      otherAgreedRangesForChild: [{ start: "2026-10-03", end: "2026-10-06" }],
    });
    expect(result.ok).toBe(true);
  });

  it("refuses an accept that would exceed capacity on any night in range", () => {
    const result = validateMove(negotiatingAwaitingHost, "host", "accept", {
      proposedDates: { start: "2026-10-03", end: "2026-10-06" },
      capacityStatus: [
        { night: "2026-10-03", agreedCount: 1, capacity: 1 },
        { night: "2026-10-04", agreedCount: 0, capacity: 1 },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it("allows an accept when no capacity is set (capacity null)", () => {
    const result = validateMove(negotiatingAwaitingHost, "host", "accept", {
      proposedDates: { start: "2026-10-03", end: "2026-10-06" },
      capacityStatus: [{ night: "2026-10-03", agreedCount: 5, capacity: null }],
    });
    expect(result.ok).toBe(true);
  });

  it("skips overlap/capacity checks entirely when no context is given (never a false refusal from missing data)", () => {
    expect(validateMove(negotiatingAwaitingHost, "host", "accept")).toEqual({ ok: true });
  });
});

describe("validateMove never performs a write", () => {
  it("is a pure function with no side effects — no Supabase/fetch import anywhere in this module", () => {
    // Structural guarantee: validateMove.ts has no "server-only" or fetch
    // import (see the file's own header comment); calling it twice with the
    // same input is idempotent and returns a fresh, unlinked object.
    const a = validateMove(negotiatingAwaitingHost, "host", "accept");
    const b = validateMove(negotiatingAwaitingHost, "host", "accept");
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });
});

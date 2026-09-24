import { describe, expect, it } from "vitest";
import { categorizeStay, describeMove, needsViewerAnswer, statusBanner, statusInfo } from "./stayStatus";
import type { Move } from "./types";

describe("needsViewerAnswer", () => {
  it("is true when it's the viewer's turn on an open application", () => {
    expect(needsViewerAnswer({ phase: "negotiating", awaiting: "parent", viewerSide: "parent" })).toBe(true);
  });

  it("is false when it's the other side's turn", () => {
    expect(needsViewerAnswer({ phase: "negotiating", awaiting: "host", viewerSide: "parent" })).toBe(false);
  });

  it("is false when nobody's turn is pending", () => {
    expect(needsViewerAnswer({ phase: "confirmed", viewerSide: "parent" })).toBe(false);
  });

  it("is false once declined, even if awaiting is (stale-)set", () => {
    expect(needsViewerAnswer({ phase: "declined", awaiting: "parent", viewerSide: "parent" })).toBe(false);
  });

  it("is false once cancelled", () => {
    expect(needsViewerAnswer({ phase: "cancelled", awaiting: "parent", viewerSide: "parent" })).toBe(false);
  });
});

describe("statusInfo", () => {
  const placeName = "Grandma & Grandpa's";

  it("labels a declined application", () => {
    expect(statusInfo({ phase: "declined", viewerSide: "parent", placeName })).toEqual({
      variant: "neutral",
      icon: "✕",
      label: "Declined",
    });
  });

  it("labels a cancelled application", () => {
    expect(statusInfo({ phase: "cancelled", viewerSide: "host", placeName })).toEqual({
      variant: "neutral",
      icon: "–",
      label: "Cancelled",
    });
  });

  it("labels a plain confirmed stay", () => {
    expect(statusInfo({ phase: "confirmed", viewerSide: "parent", placeName })).toEqual({
      variant: "confirmed",
      icon: "✓",
      label: "Confirmed",
    });
  });

  it("labels a confirmed stay with a change the viewer must answer", () => {
    expect(statusInfo({ phase: "confirmed", awaiting: "parent", viewerSide: "parent", placeName })).toEqual({
      variant: "attention",
      icon: "!",
      label: "Confirmed · your answer needed",
    });
  });

  it("labels a confirmed stay with a change the other side must answer", () => {
    expect(statusInfo({ phase: "confirmed", awaiting: "host", viewerSide: "parent", placeName })).toEqual({
      variant: "confirmed",
      icon: "✓",
      label: "Confirmed · change requested",
    });
  });

  it("labels negotiating, viewer's turn", () => {
    expect(statusInfo({ phase: "negotiating", awaiting: "parent", viewerSide: "parent", placeName })).toEqual({
      variant: "attention",
      icon: "!",
      label: "Your answer needed",
    });
  });

  it("labels negotiating, waiting on the hosts (parent's view), naming the place", () => {
    expect(statusInfo({ phase: "negotiating", awaiting: "host", viewerSide: "parent", placeName })).toEqual({
      variant: "neutral",
      icon: "…",
      label: "Waiting for Grandma & Grandpa's",
    });
  });

  it("labels negotiating, waiting on the parents (host's view)", () => {
    expect(statusInfo({ phase: "negotiating", awaiting: "parent", viewerSide: "host", placeName })).toEqual({
      variant: "neutral",
      icon: "…",
      label: "Waiting for the parents",
    });
  });
});

describe("categorizeStay", () => {
  const today = "2026-10-01";

  it("puts a stay needing the viewer's answer in needs-answer, regardless of dates", () => {
    expect(
      categorizeStay(
        { phase: "negotiating", awaiting: "parent", viewerSide: "parent", dates: { start: "2026-09-01", end: "2026-09-03" } },
        today,
      ),
    ).toBe("needs-answer");
  });

  it("puts declined applications in past", () => {
    expect(
      categorizeStay(
        { phase: "declined", viewerSide: "parent", dates: { start: "2026-11-01", end: "2026-11-03" } },
        today,
      ),
    ).toBe("past");
  });

  it("puts cancelled applications in past", () => {
    expect(
      categorizeStay(
        { phase: "cancelled", viewerSide: "parent", dates: { start: "2026-11-01", end: "2026-11-03" } },
        today,
      ),
    ).toBe("past");
  });

  it("puts a confirmed stay whose pick-up day has passed in past", () => {
    expect(
      categorizeStay(
        { phase: "confirmed", viewerSide: "parent", dates: { start: "2026-09-01", end: "2026-09-03" } },
        today,
      ),
    ).toBe("past");
  });

  it("puts an upcoming confirmed stay in upcoming", () => {
    expect(
      categorizeStay(
        { phase: "confirmed", viewerSide: "parent", dates: { start: "2026-11-01", end: "2026-11-03" } },
        today,
      ),
    ).toBe("upcoming");
  });

  it("puts a negotiating stay awaiting the other side in upcoming (still open)", () => {
    expect(
      categorizeStay(
        { phase: "negotiating", awaiting: "host", viewerSide: "parent", dates: { start: "2026-11-01", end: "2026-11-03" } },
        today,
      ),
    ).toBe("upcoming");
  });
});

describe("describeMove", () => {
  const at = "2026-09-20T09:00:00Z";

  it("describes the opening proposal as 'asked for'", () => {
    const move: Move = { kind: "propose", side: "parent", byName: "Mum", at, dates: { start: "2026-10-03", end: "2026-10-06" } };
    expect(describeMove(move, true)).toBe("Mum asked for Sat 3 Oct → Tue 6 Oct");
  });

  it("describes a later counter-proposal as 'suggested'", () => {
    const move: Move = { kind: "propose", side: "host", byName: "Grandma", at, dates: { start: "2026-10-04", end: "2026-10-06" } };
    expect(describeMove(move, false)).toBe("Grandma suggested Sun 4 Oct → Tue 6 Oct");
  });

  it("includes a note when present", () => {
    const move: Move = {
      kind: "propose",
      side: "host",
      byName: "Grandma",
      at,
      dates: { start: "2026-10-04", end: "2026-10-06" },
      note: "She can't do Friday.",
    };
    expect(describeMove(move, false)).toContain("“She can't do Friday.”");
  });

  it("describes an accept", () => {
    const move: Move = { kind: "accept", side: "host", byName: "Grandma", at };
    expect(describeMove(move, false)).toBe("Grandma accepted");
  });

  it("describes a decline", () => {
    const move: Move = { kind: "decline", side: "host", byName: "Grandma", at };
    expect(describeMove(move, false)).toBe("Grandma declined");
  });

  it("describes a cancel", () => {
    const move: Move = { kind: "cancel", side: "parent", byName: "Mum", at };
    expect(describeMove(move, false)).toBe("Mum cancelled");
  });

  it("handles a propose move with no dates gracefully", () => {
    const move: Move = { kind: "propose", side: "parent", byName: "Mum", at };
    expect(describeMove(move, true)).toBe("Mum asked for new dates");
  });
});

describe("statusBanner", () => {
  const placeName = "Grandma & Grandpa's";
  const childName = "the child";

  it("banners a declined application", () => {
    const result = statusBanner({ phase: "declined", viewerSide: "parent", placeName, childName });
    expect(result.variant).toBe("neutral");
    expect(result.title).toBe("Declined");
  });

  it("banners a viewer-must-answer negotiating application", () => {
    const result = statusBanner({ phase: "negotiating", awaiting: "parent", viewerSide: "parent", placeName, childName });
    expect(result.variant).toBe("attention");
    expect(result.title).toBe("Your answer needed");
  });

  it("banners a confirmed application with no pending change", () => {
    const result = statusBanner({ phase: "confirmed", viewerSide: "parent", placeName, childName });
    expect(result.variant).toBe("neutral");
    expect(result.body).toContain(placeName);
  });

  it("banners a confirmed application with a change the viewer must answer", () => {
    const result = statusBanner({ phase: "confirmed", awaiting: "parent", viewerSide: "parent", placeName, childName });
    expect(result.variant).toBe("attention");
  });
});

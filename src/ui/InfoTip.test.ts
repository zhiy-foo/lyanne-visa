import { describe, expect, it } from "vitest";
import { nextInfoTipOpen } from "./InfoTip";

describe("nextInfoTipOpen", () => {
  it("opens on hover-enter", () => {
    expect(nextInfoTipOpen(false, "hover-enter")).toBe(true);
  });

  it("opens on keyboard focus", () => {
    expect(nextInfoTipOpen(false, "focus")).toBe(true);
  });

  it("closes on hover-leave", () => {
    expect(nextInfoTipOpen(true, "hover-leave")).toBe(false);
  });

  it("closes on blur", () => {
    expect(nextInfoTipOpen(true, "blur")).toBe(false);
  });

  it("closes on Escape", () => {
    expect(nextInfoTipOpen(true, "escape")).toBe(false);
  });

  it("closes on an outside tap", () => {
    expect(nextInfoTipOpen(true, "outside")).toBe(false);
  });

  it("toggles open on click when closed (the touch path)", () => {
    expect(nextInfoTipOpen(false, "toggle")).toBe(true);
  });

  it("toggles closed on click when already open", () => {
    expect(nextInfoTipOpen(true, "toggle")).toBe(false);
  });

  it("is a no-op for an already-closed state receiving a close event", () => {
    expect(nextInfoTipOpen(false, "blur")).toBe(false);
    expect(nextInfoTipOpen(false, "escape")).toBe(false);
    expect(nextInfoTipOpen(false, "outside")).toBe(false);
  });

  it("is a no-op for an already-open state receiving an open event", () => {
    expect(nextInfoTipOpen(true, "hover-enter")).toBe(true);
    expect(nextInfoTipOpen(true, "focus")).toBe(true);
  });
});

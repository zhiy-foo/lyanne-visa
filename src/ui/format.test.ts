import { describe, expect, it } from "vitest";
import { formatCountdown } from "./format";

describe("formatCountdown", () => {
  it("formats seconds under a minute as 0:ss", () => {
    expect(formatCountdown(45)).toBe("0:45");
    expect(formatCountdown(9)).toBe("0:09");
  });

  it("formats a full minute as 1:00", () => {
    expect(formatCountdown(60)).toBe("1:00");
  });

  it("formats zero as 0:00", () => {
    expect(formatCountdown(0)).toBe("0:00");
  });

  it("formats more than a minute as m:ss", () => {
    expect(formatCountdown(125)).toBe("2:05");
  });

  it("truncates fractional seconds", () => {
    expect(formatCountdown(45.9)).toBe("0:45");
  });

  it("clamps negative input to 0:00", () => {
    expect(formatCountdown(-5)).toBe("0:00");
  });
});

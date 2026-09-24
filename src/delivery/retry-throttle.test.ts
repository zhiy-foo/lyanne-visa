import { describe, expect, it } from "vitest";
import { createRetryThrottle } from "./retry-throttle";

describe("createRetryThrottle", () => {
  it("allows the first call", () => {
    const throttle = createRetryThrottle({ now: () => 1000 });
    expect(throttle.shouldRun()).toBe(true);
  });

  it("refuses a second call inside the window", () => {
    let t = 0;
    const throttle = createRetryThrottle({ windowMs: 60_000, now: () => t });
    expect(throttle.shouldRun()).toBe(true);
    t += 1_000;
    expect(throttle.shouldRun()).toBe(false);
    t += 10_000;
    expect(throttle.shouldRun()).toBe(false);
  });

  it("allows a call again once the window has elapsed", () => {
    let t = 0;
    const throttle = createRetryThrottle({ windowMs: 60_000, now: () => t });
    expect(throttle.shouldRun()).toBe(true);
    t += 60_000;
    expect(throttle.shouldRun()).toBe(true);
  });

  it("repeated calls within the window across many requests still only run once", () => {
    let t = 0;
    const throttle = createRetryThrottle({ windowMs: 60_000, now: () => t });
    const results = Array.from({ length: 20 }, () => {
      t += 100;
      return throttle.shouldRun();
    });
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});

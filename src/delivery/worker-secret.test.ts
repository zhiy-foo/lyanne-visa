import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Security fix (20260924001100_delivery_outbox.sql's worker-secret check):
 * `deliveryWorkerSecret()` is the server-only getter a later pass wires into
 * the claim_pending_dispatches/record_dispatch_outcome RPC calls. This pass
 * only covers the getter itself; mailer.test.ts's import-boundary test
 * covers that nothing else under src/delivery/ reads the raw env var.
 */
describe("deliveryWorkerSecret", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.DELIVERY_WORKER_SECRET;
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it("throws when DELIVERY_WORKER_SECRET is unset", async () => {
    const { deliveryWorkerSecret } = await import("./worker-secret");
    expect(() => deliveryWorkerSecret()).toThrow(/DELIVERY_WORKER_SECRET/);
  });

  it("throws when DELIVERY_WORKER_SECRET is set but empty", async () => {
    process.env.DELIVERY_WORKER_SECRET = "";
    const { deliveryWorkerSecret } = await import("./worker-secret");
    expect(() => deliveryWorkerSecret()).toThrow(/DELIVERY_WORKER_SECRET/);
  });

  it("returns the value once set", async () => {
    process.env.DELIVERY_WORKER_SECRET = "a-long-random-secret";
    const { deliveryWorkerSecret } = await import("./worker-secret");
    expect(deliveryWorkerSecret()).toBe("a-long-random-secret");
  });
});

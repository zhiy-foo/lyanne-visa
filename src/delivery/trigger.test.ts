import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// "server-only" is vendored inside next/dist/compiled and resolved via
// Next's own bundler aliasing at build time — it is not a real top-level
// node_modules package, so plain Node module resolution (which vitest uses)
// cannot find it. Stub it so this file's `import "server-only"` resolves
// under vitest, matching how every other "server-only"-tagged module in
// this codebase (src/stayover/events.server.ts, account.ts, data/*.ts, ...)
// is only ever exercised through Next's build/e2e, never a direct vitest
// import — this is the one such module this pass unit-tests directly.
vi.mock("server-only", () => ({}));

/**
 * Task 4.3: triggerDeliveryRetry never throws, regardless of what
 * sendPendingDispatchesFromRequest does — the guarantee `after()` callers
 * (src/stayover/actions/stays.ts, src/stayover/actions/register.ts) rely on
 * so a delivery failure of any kind can never surface as an action failure.
 */

vi.mock("./send-pending-dispatches.server", () => ({
  sendPendingDispatchesFromRequest: vi.fn(),
}));

describe("triggerDeliveryRetry", () => {
  const originalError = console.error;

  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalError;
    vi.resetAllMocks();
  });

  it("resolves normally when sendPendingDispatchesFromRequest resolves", async () => {
    const { sendPendingDispatchesFromRequest } = await import("./send-pending-dispatches.server");
    vi.mocked(sendPendingDispatchesFromRequest).mockResolvedValue({ claimed: 1, sent: 1, failed: 0, superseded: 0 });

    const { triggerDeliveryRetry } = await import("./trigger");
    await expect(triggerDeliveryRetry({} as never)).resolves.toBeUndefined();
  });

  it("swallows and logs any rejection instead of propagating it", async () => {
    const { sendPendingDispatchesFromRequest } = await import("./send-pending-dispatches.server");
    vi.mocked(sendPendingDispatchesFromRequest).mockRejectedValue(new Error("db unreachable"));

    const { triggerDeliveryRetry } = await import("./trigger");
    await expect(triggerDeliveryRetry({} as never)).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("[delivery]"), expect.any(Error));
  });
});

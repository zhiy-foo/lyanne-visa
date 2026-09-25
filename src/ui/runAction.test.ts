import { afterEach, describe, expect, it, vi } from "vitest";
import { ACTION_FAILURE_MESSAGE, runAction } from "./runAction";

describe("runAction", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes a successful result through unchanged", async () => {
    const result = await runAction(async () => ({ ok: true as const, retryAfterSeconds: 5 }));
    expect(result).toEqual({ ok: true, retryAfterSeconds: 5 });
  });

  it("passes a failed ActionResult through unchanged", async () => {
    const result = await runAction(async () => ({ ok: false as const, message: "That code isn't right." }));
    expect(result).toEqual({ ok: false, message: "That code isn't right." });
  });

  it("resolves to the fallback message when the action throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await runAction(async () => {
      throw new Error("404: action not found");
    });
    expect(result).toEqual({ ok: false, message: ACTION_FAILURE_MESSAGE });
  });

  it("resolves to the fallback message when the action rejects", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await runAction(() => Promise.reject(new Error("network error")));
    expect(result).toEqual({ ok: false, message: ACTION_FAILURE_MESSAGE });
  });

  it("logs the caught error to the console", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("boom");
    await runAction(async () => {
      throw error;
    });
    expect(consoleError).toHaveBeenCalledWith(error);
  });
});

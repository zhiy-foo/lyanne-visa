import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Task 4.2's remaining wiring: sendPendingDispatchesFromRequest against a
 * fake Supabase RPC client (no real database — the RPC contract itself is
 * verified in test/db/delivery-outbox.test.ts and
 * test/db/delivery-queue.test.ts).
 */

function fakeSupabase(rpcImpl: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>) {
  return { rpc: vi.fn(rpcImpl) } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

const dbRow = (overrides: Record<string, unknown> = {}) => ({
  id: "d1",
  member_id: null,
  application_id: null,
  to_email: "grandma@example.com",
  kind: "notice",
  revision: 0,
  status: "pending",
  attempts: 0,
  last_error: null,
  claimed_at: null,
  created_at: "2026-09-24T00:00:00.000Z",
  updated_at: "2026-09-24T00:00:00.000Z",
  payload: { notice_kind: "propose", child_name: "Lyanne", place_name: "Grandma's" },
  ...overrides,
});

describe("sendPendingDispatchesFromRequest", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.DELIVERY_WORKER_SECRET;
    delete process.env.DELIVERY_SMTP_USER;
    delete process.env.DELIVERY_SMTP_APP_PASSWORD;
    delete process.env.DELIVERY_FROM_ADDRESS;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it("returns null (a no-op) without throwing when DELIVERY_WORKER_SECRET is unset", async () => {
    const { sendPendingDispatchesFromRequest } = await import("./send-pending-dispatches.server");
    const supabase = fakeSupabase(async () => ({ data: null, error: null }));
    const result = await sendPendingDispatchesFromRequest(supabase);
    expect(result).toBeNull();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("claims, renders (console mailer, no SMTP configured) and records sent, passing the secret through", async () => {
    process.env.DELIVERY_WORKER_SECRET = "worker-secret";
    const calls: { fn: string; args?: Record<string, unknown> }[] = [];

    const supabase = fakeSupabase(async (fn, args) => {
      calls.push({ fn, args });
      if (fn === "claim_pending_dispatches") return { data: [dbRow()], error: null };
      if (fn === "record_dispatch_outcome") return { data: dbRow({ status: "sent", attempts: 1 }), error: null };
      return { data: null, error: null };
    });

    const { sendPendingDispatchesFromRequest } = await import("./send-pending-dispatches.server");
    const result = await sendPendingDispatchesFromRequest(supabase, 5);

    expect(result).toEqual({ claimed: 1, sent: 1, failed: 0, superseded: 0 });
    expect(calls[0]).toEqual({ fn: "claim_pending_dispatches", args: { p_secret: "worker-secret", p_limit: 5 } });
    expect(calls.at(-1)?.fn).toBe("record_dispatch_outcome");
    expect(calls.at(-1)?.args).toMatchObject({ p_secret: "worker-secret", p_status: "sent" });
  });

  it("consults dispatch_is_superseded only for an invite with a non-null applicationId", async () => {
    process.env.DELIVERY_WORKER_SECRET = "worker-secret";
    const supabase = fakeSupabase(async (fn) => {
      if (fn === "claim_pending_dispatches") {
        return {
          data: [dbRow({ id: "inv-1", kind: "invite", application_id: "app-1", revision: 1, payload: { method: "REQUEST" } })],
          error: null,
        };
      }
      if (fn === "dispatch_is_superseded") return { data: true, error: null };
      if (fn === "record_dispatch_outcome") return { data: dbRow({ id: "inv-1", status: "sent" }), error: null };
      return { data: null, error: null };
    });

    const { sendPendingDispatchesFromRequest } = await import("./send-pending-dispatches.server");
    const result = await sendPendingDispatchesFromRequest(supabase);

    expect(result).toEqual({ claimed: 1, sent: 0, failed: 0, superseded: 1 });
    expect(supabase.rpc).toHaveBeenCalledWith(
      "dispatch_is_superseded",
      expect.objectContaining({ p_application: "app-1", p_revision: 1 }),
    );
  });

  it("a claim RPC error propagates (infrastructure failure, not a delivery failure)", async () => {
    process.env.DELIVERY_WORKER_SECRET = "worker-secret";
    const supabase = fakeSupabase(async (fn) => {
      if (fn === "claim_pending_dispatches") return { data: null, error: { message: "db unreachable" } };
      return { data: null, error: null };
    });

    const { sendPendingDispatchesFromRequest } = await import("./send-pending-dispatches.server");
    await expect(sendPendingDispatchesFromRequest(supabase)).rejects.toThrow();
  });
});

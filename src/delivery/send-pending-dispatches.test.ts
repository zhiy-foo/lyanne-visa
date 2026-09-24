import { describe, expect, it, vi } from "vitest";
import { sendPendingDispatches } from "./send-pending-dispatches";
import type { DispatchRow, SendPendingDispatchesDeps } from "./send-pending-dispatches";
import type { EmailMessage, Mailer, SendResult } from "./types";

/**
 * Task 4.2 (core): sendPendingDispatches, exercised entirely against an
 * in-memory fake outbox (no database) — proving the function's own
 * dependency shape is enough to test the claim → (supersede?) → render →
 * send → record loop, per tasks.md 4.2's "verify" clause.
 *
 * The fake `claim`/`record` below reimplements just enough of
 * claim_pending_dispatches/record_dispatch_outcome's *observable contract*
 * (20260924001100_delivery_outbox.sql) to drive these scenarios — bounded
 * retry to 4 attempts, `failed` only at the 4th, idempotent against an
 * already-terminal row — without touching Postgres. The DB-level behaviour
 * itself is verified separately in test/db/delivery-outbox.test.ts.
 */

function makeRow(overrides: Partial<DispatchRow> = {}): DispatchRow {
  return {
    id: overrides.id ?? "dispatch-1",
    memberId: null,
    applicationId: null,
    toEmail: "grandma@example.com",
    kind: "notice",
    revision: 0,
    status: "pending",
    attempts: 0,
    lastError: null,
    claimedAt: null,
    createdAt: "2026-09-24T00:00:00.000Z",
    updatedAt: "2026-09-24T00:00:00.000Z",
    ...overrides,
  };
}

/** In-memory outbox mirroring the DB functions' observable behaviour. */
function createFakeOutbox(initialRows: DispatchRow[]) {
  const rows = new Map(initialRows.map((r) => [r.id, { ...r }]));

  const claim = vi.fn(async (batchSize: number): Promise<DispatchRow[]> => {
    return [...rows.values()]
      .filter((r) => r.status === "pending")
      .slice(0, batchSize)
      .map((r) => ({ ...r }));
  });

  const record = vi.fn(
    async (id: string, status: "sent" | "failed", error?: string): Promise<DispatchRow> => {
      const row = rows.get(id);
      if (!row) throw new Error(`no such dispatch: ${id}`);

      if (row.status === "sent" || row.status === "failed") {
        return { ...row }; // idempotent, mirrors record_dispatch_outcome
      }

      const attempts = row.attempts + 1;
      if (status === "sent") {
        row.status = "sent";
        row.attempts = attempts;
        row.lastError = null;
      } else {
        row.attempts = attempts;
        row.status = attempts >= 4 ? "failed" : "pending";
        row.lastError = row.status === "failed" ? (error ?? "unknown_error") : null;
      }
      row.updatedAt = new Date().toISOString();
      rows.set(id, row);
      return { ...row };
    },
  );

  return {
    claim,
    record,
    get: (id: string) => rows.get(id),
    all: () => [...rows.values()],
  };
}

const passthroughRender = (dispatch: DispatchRow): EmailMessage => ({
  to: dispatch.toEmail,
  subject: `about dispatch ${dispatch.id}`,
  text: "body",
});

function alwaysFalseSuperseded(): Promise<boolean> {
  return Promise.resolve(false);
}

describe("sendPendingDispatches", () => {
  it("happy path: claims, renders, sends, and records sent", async () => {
    const outbox = createFakeOutbox([makeRow({ id: "d1" })]);
    const sendSpy = vi.fn(async (): Promise<SendResult> => ({ ok: true }));
    const mailer: Mailer = { send: sendSpy };

    const deps: SendPendingDispatchesDeps = {
      claim: outbox.claim,
      record: outbox.record,
      render: passthroughRender,
      mailer,
      isSuperseded: alwaysFalseSuperseded,
    };

    const result = await sendPendingDispatches(10, deps);

    expect(result).toEqual({ claimed: 1, sent: 1, failed: 0, superseded: 0 });
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({ to: "grandma@example.com" }),
    );
    expect(outbox.get("d1")?.status).toBe("sent");
    expect(outbox.get("d1")?.attempts).toBe(1);
    expect(outbox.get("d1")?.lastError).toBeNull();
  });

  it("claiming nothing is a no-op that touches neither render nor mailer", async () => {
    const outbox = createFakeOutbox([]);
    const render = vi.fn(passthroughRender);
    const sendSpy = vi.fn(async (): Promise<SendResult> => ({ ok: true }));

    const result = await sendPendingDispatches(10, {
      claim: outbox.claim,
      record: outbox.record,
      render,
      mailer: { send: sendSpy },
      isSuperseded: alwaysFalseSuperseded,
    });

    expect(result).toEqual({ claimed: 0, sent: 0, failed: 0, superseded: 0 });
    expect(render).not.toHaveBeenCalled();
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("a forced mailer failure increments attempts and reaches failed only at the 4th attempt", async () => {
    const outbox = createFakeOutbox([makeRow({ id: "d1" })]);
    const failingMailer: Mailer = {
      send: async () => ({ ok: false, error: "smtp rejected" }),
    };
    const deps: SendPendingDispatchesDeps = {
      claim: outbox.claim,
      record: outbox.record,
      render: passthroughRender,
      mailer: failingMailer,
      isSuperseded: alwaysFalseSuperseded,
    };

    // Attempts 1-3: recorded failed this call, but the row goes back to
    // pending (so a later batch can retry it) — not yet terminal.
    for (let i = 1; i <= 3; i++) {
      const result = await sendPendingDispatches(10, deps);
      expect(result).toEqual({ claimed: 1, sent: 0, failed: 1, superseded: 0 });
      expect(outbox.get("d1")?.status).toBe("pending");
      expect(outbox.get("d1")?.attempts).toBe(i);
      expect(outbox.get("d1")?.lastError).toBeNull(); // not FAILED yet
    }

    // 4th attempt: now terminal, with the last error recorded.
    const fourth = await sendPendingDispatches(10, deps);
    expect(fourth).toEqual({ claimed: 1, sent: 0, failed: 1, superseded: 0 });
    expect(outbox.get("d1")?.status).toBe("failed");
    expect(outbox.get("d1")?.attempts).toBe(4);
    expect(outbox.get("d1")?.lastError).toBe("smtp rejected");

    // A 5th call claims nothing — the row is terminal and no longer pending.
    const fifth = await sendPendingDispatches(10, deps);
    expect(fifth).toEqual({ claimed: 0, sent: 0, failed: 0, superseded: 0 });
  });

  it("a render failure is also recorded as a failed attempt, without ever calling the mailer", async () => {
    const outbox = createFakeOutbox([makeRow({ id: "d1" })]);
    const sendSpy = vi.fn(async (): Promise<SendResult> => ({ ok: true }));
    const throwingRender = (): EmailMessage => {
      throw new Error("malformed calendar facts");
    };

    const result = await sendPendingDispatches(10, {
      claim: outbox.claim,
      record: outbox.record,
      render: throwingRender,
      mailer: { send: sendSpy },
      isSuperseded: alwaysFalseSuperseded,
    });

    expect(result).toEqual({ claimed: 1, sent: 0, failed: 1, superseded: 0 });
    expect(sendSpy).not.toHaveBeenCalled();
    expect(outbox.get("d1")?.attempts).toBe(1);
    expect(outbox.get("d1")?.status).toBe("pending");
  });

  it("a superseded stale invite is not sent, is resolved without calling the mailer, and leaves the newer revision's row untouched", async () => {
    const staleInvite = makeRow({
      id: "stale",
      kind: "invite",
      applicationId: "app-1",
      revision: 1,
      status: "pending",
    });
    const newerInvite = makeRow({
      id: "newer",
      kind: "invite",
      applicationId: "app-1",
      revision: 2,
      status: "sent",
      attempts: 1,
    });
    const outbox = createFakeOutbox([staleInvite, newerInvite]);
    const sendSpy = vi.fn(async (): Promise<SendResult> => ({ ok: true }));

    const isSuperseded = vi.fn(async (dispatch: DispatchRow) => {
      // Mirrors design.md Decision 3: a sent dispatch for the same
      // application with a higher revision already exists.
      return outbox
        .all()
        .some(
          (r) =>
            r.id !== dispatch.id &&
            r.applicationId === dispatch.applicationId &&
            r.kind === "invite" &&
            r.status === "sent" &&
            r.revision > dispatch.revision,
        );
    });

    const result = await sendPendingDispatches(10, {
      claim: outbox.claim,
      record: outbox.record,
      render: passthroughRender,
      mailer: { send: sendSpy },
      isSuperseded,
    });

    expect(result).toEqual({ claimed: 1, sent: 0, failed: 0, superseded: 1 });
    expect(sendSpy).not.toHaveBeenCalled();
    expect(isSuperseded).toHaveBeenCalledWith(expect.objectContaining({ id: "stale" }));

    // The stale row is resolved (terminal `sent`, as a no-op) so it is never
    // reclaimed again — but it was never actually mailed.
    expect(outbox.get("stale")?.status).toBe("sent");
    expect(outbox.get("stale")?.attempts).toBe(1);

    // The newer revision's own row is completely untouched — no attempt was
    // consumed against it.
    expect(outbox.get("newer")?.attempts).toBe(1);
    expect(outbox.get("newer")?.status).toBe("sent");
  });

  it("isSuperseded is never consulted for a notice (only invites can be superseded)", async () => {
    const outbox = createFakeOutbox([makeRow({ id: "d1", kind: "notice", applicationId: "app-1" })]);
    const isSuperseded = vi.fn(alwaysFalseSuperseded);
    const sendSpy = vi.fn(async (): Promise<SendResult> => ({ ok: true }));

    await sendPendingDispatches(10, {
      claim: outbox.claim,
      record: outbox.record,
      render: passthroughRender,
      mailer: { send: sendSpy },
      isSuperseded,
    });

    expect(isSuperseded).not.toHaveBeenCalled();
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it("isSuperseded is never consulted for an invite whose application was hard-deleted (applicationId null)", async () => {
    const outbox = createFakeOutbox([
      makeRow({ id: "d1", kind: "invite", applicationId: null, revision: 3 }),
    ]);
    const isSuperseded = vi.fn(alwaysFalseSuperseded);
    const sendSpy = vi.fn(async (): Promise<SendResult> => ({ ok: true }));

    await sendPendingDispatches(10, {
      claim: outbox.claim,
      record: outbox.record,
      render: passthroughRender,
      mailer: { send: sendSpy },
      isSuperseded,
    });

    expect(isSuperseded).not.toHaveBeenCalled();
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it("processes a full batch of independent rows, mixing sent and failed outcomes", async () => {
    const outbox = createFakeOutbox([
      makeRow({ id: "ok-1", toEmail: "a@example.com" }),
      makeRow({ id: "ok-2", toEmail: "b@example.com" }),
      makeRow({ id: "bad-1", toEmail: "c@example.com" }),
    ]);
    const mailer: Mailer = {
      send: async (message) => (message.to === "c@example.com" ? { ok: false, error: "bounced" } : { ok: true }),
    };

    const result = await sendPendingDispatches(10, {
      claim: outbox.claim,
      record: outbox.record,
      render: passthroughRender,
      mailer,
      isSuperseded: alwaysFalseSuperseded,
    });

    expect(result).toEqual({ claimed: 3, sent: 2, failed: 1, superseded: 0 });
    expect(outbox.get("ok-1")?.status).toBe("sent");
    expect(outbox.get("ok-2")?.status).toBe("sent");
    expect(outbox.get("bad-1")?.status).toBe("pending"); // 1st failure, not yet terminal
  });

  it("respects batchSize by delegating it to claim", async () => {
    const outbox = createFakeOutbox([makeRow({ id: "d1" }), makeRow({ id: "d2" })]);
    const sendSpy = vi.fn(async (): Promise<SendResult> => ({ ok: true }));

    await sendPendingDispatches(1, {
      claim: outbox.claim,
      record: outbox.record,
      render: passthroughRender,
      mailer: { send: sendSpy },
      isSuperseded: alwaysFalseSuperseded,
    });

    expect(outbox.claim).toHaveBeenCalledWith(1);
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });
});

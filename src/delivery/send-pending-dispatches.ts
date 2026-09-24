// sendPendingDispatches (task 4.2 core; design.md Decisions b, c, 2;
// ARCHITECTURE.md §7 `dispatch ⊸`). Takes every dependency injected so it is
// testable without a database (tasks.md 4.2: "claims via 1.2, renders via
// 3.2/3.3, sends via 4.1, records the outcome via 1.2").
//
// What THIS pass wires concretely: `claim`/`record` against
// claim_pending_dispatches/record_dispatch_outcome
// (20260924001100_delivery_outbox.sql), `mailer` against getMailer()
// (mailer.ts), and `render` for INVITE kind against renderIcs (render-ics.ts,
// this pass's task 3.2). What the NEXT pass wires: `render` for NOTICE kind
// needs renderNotice (task 3.3, StayoverEvent × Member → EmailMessage) and a
// full INVITE render needs buildEvent (task 3.1, calendarFacts →
// CalendarEvent) upstream of renderIcs — both depend on the `stays`
// StayoverEvent port another agent is building right now, so `render` stays
// a single injected function here rather than switching on `dispatch.kind`
// itself; `isSuperseded` similarly needs a real query against `dispatch`
// (design.md Decision 3: "dispatch itself is the record that lets rule 3
// ... be checked") that the next pass wires against Postgres.

import type { EmailMessage, Mailer } from "./types";

/**
 * One claimed row from `dispatch` (snake_case DB columns are mapped to this
 * camelCase shape by whatever wires `claim` against
 * claim_pending_dispatches — see this file's header comment).
 */
export interface DispatchRow {
  id: string;
  memberId: string | null;
  applicationId: string | null;
  toEmail: string;
  kind: "notice" | "invite";
  revision: number;
  status: "pending" | "sent" | "failed";
  attempts: number;
  lastError: string | null;
  claimedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** `dispatch.payload` (20260924001200_delivery_queue.sql) — the snapshot
   * taken at queue time, everything `render` needs with no further read. */
  payload: Record<string, unknown>;
}

export type DispatchOutcomeStatus = "sent" | "failed";

/** The dependencies sendPendingDispatches needs — the next pass wires each of these. */
export interface SendPendingDispatchesDeps {
  /** Claims up to `batchSize` pending (or stale-claimed) dispatch rows — wraps claim_pending_dispatches. */
  claim: (batchSize: number) => Promise<DispatchRow[]>;
  /** Records one attempt's outcome for a dispatch row — wraps record_dispatch_outcome. Returns the row as it now stands. */
  record: (dispatchId: string, status: DispatchOutcomeStatus, error?: string) => Promise<DispatchRow>;
  /** Renders a claimed dispatch row into an EmailMessage (task 3.2 for invites, task 3.3 for notices — not this pass's concern which). */
  render: (dispatch: DispatchRow) => Promise<EmailMessage> | EmailMessage;
  /** The Mailer port (task 4.1) — typically getMailer()'s result. */
  mailer: Mailer;
  /**
   * design.md Decision 3 / spec "A stale retry is superseded": true iff a
   * later revision of an INVITE for the same application has already been
   * recorded as `sent`. Only ever consulted for `kind === "invite"` with a
   * non-null `applicationId`; irrelevant for notices (spec never supersedes
   * a notice) and for an invite whose application was hard-deleted
   * (`applicationId` null after delete — nothing left to be superseded by).
   */
  isSuperseded: (dispatch: DispatchRow) => Promise<boolean>;
}

export interface SendPendingDispatchesResult {
  /** How many rows this call claimed (attempted, superseded, or otherwise). */
  claimed: number;
  /** Rows whose mailer.send succeeded and were recorded `sent` this call. */
  sent: number;
  /** Rows whose attempt failed this call (may still be `pending` for another retry, or now terminal `failed`). */
  failed: number;
  /** Rows dropped as a stale, already-superseded invite (spec: "the stale invite is not sent") — resolved `sent` as a no-op, never handed to the mailer. */
  superseded: number;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * `dispatch ⊸ : PlannedDispatch → Dispatch` (ARCHITECTURE.md §7) — the
 * bounded-retry send loop: claim → (drop if superseded) → render → send →
 * record. Never throws for an individual row's failure (a render or mailer
 * failure is recorded via `deps.record` and the loop continues) — only a
 * failure of `deps.claim`/`deps.record`/`deps.isSuperseded` themselves
 * (infrastructure failures, not delivery failures) propagates, since those
 * indicate the outbox itself is unreachable, not that one message failed to
 * send.
 */
export async function sendPendingDispatches(
  batchSize: number,
  deps: SendPendingDispatchesDeps,
): Promise<SendPendingDispatchesResult> {
  const rows = await deps.claim(batchSize);

  const result: SendPendingDispatchesResult = { claimed: rows.length, sent: 0, failed: 0, superseded: 0 };

  for (const dispatch of rows) {
    if (dispatch.kind === "invite" && dispatch.applicationId && (await deps.isSuperseded(dispatch))) {
      // Spec "A stale retry is superseded": dropped, not sent. Recorded
      // `sent` as a no-op so the row becomes terminal and is never reclaimed
      // again, without ever calling the mailer or touching the newer
      // revision's own row/attempts.
      await deps.record(dispatch.id, "sent");
      result.superseded += 1;
      continue;
    }

    let message: EmailMessage;
    try {
      message = await deps.render(dispatch);
    } catch (err) {
      await deps.record(dispatch.id, "failed", errorMessage(err));
      result.failed += 1;
      continue;
    }

    const sendResult = await deps.mailer.send(message);
    if (sendResult.ok) {
      await deps.record(dispatch.id, "sent");
      result.sent += 1;
    } else {
      await deps.record(dispatch.id, "failed", sendResult.error);
      result.failed += 1;
    }
  }

  return result;
}

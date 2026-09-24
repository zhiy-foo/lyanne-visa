// Wires sendPendingDispatches' injected dependencies against real Postgres
// RPCs (task 4.2's remaining wiring): claim/record against
// claim_pending_dispatches/record_dispatch_outcome
// (20260924001100_delivery_outbox.sql), render against renderDispatch
// (dispatch-render.ts, this pass), mailer against getMailer() (mailer.ts),
// and isSuperseded against dispatch_is_superseded
// (20260924001200_delivery_queue.sql). Takes the caller's own Supabase
// client (a server action's request-scoped client, or proxy.ts's own) —
// this module never creates one itself, so it works from either call site
// (task 4.3, 4.4) without depending on `next/headers`' `cookies()`, which
// only works inside a Server Component/Action/Route Handler, not proxy.ts.
//
// Never throws for a missing worker secret or missing SMTP config — both
// are "delivery is skipped/console-doubled with a log line", never a reason
// to fail the caller (design.md Decision b: "a delivery failure never
// blocks... the action"). A genuine RPC failure (e.g. the database is
// unreachable) DOES throw from inside claim/record/isSuperseded — by
// design (send-pending-dispatches.ts's own header comment: "only a failure
// of deps.claim/deps.record/deps.isSuperseded ... propagates"); callers of
// this module (task 4.3, 4.4) are responsible for swallowing that so it
// never fails the triggering action either.

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPendingDispatches } from "./send-pending-dispatches";
import type { DispatchRow, SendPendingDispatchesDeps, SendPendingDispatchesResult } from "./send-pending-dispatches";
import { getMailer } from "./mailer";
import { renderDispatch } from "./dispatch-render";
import { deliveryWorkerSecret } from "./worker-secret";
import { fromAddress, smtpConfigured } from "./mailer-smtp";
// Relative, not "@/..." — vitest.config.mts has no path-alias resolution
// (only tsconfig.json/Next.js's bundler do), so an "@/" import here would
// resolve at build time but fail every test that imports this module.
import { siteUrl } from "../stayover/supabase/env";

const DEFAULT_BATCH_SIZE = 20;

type DbDispatchRow = {
  id: string;
  member_id: string | null;
  application_id: string | null;
  to_email: string;
  kind: "notice" | "invite";
  revision: number;
  status: "pending" | "sent" | "failed";
  attempts: number;
  last_error: string | null;
  claimed_at: string | null;
  created_at: string;
  updated_at: string;
  payload: Record<string, unknown> | null;
};

function mapRow(row: DbDispatchRow): DispatchRow {
  return {
    id: row.id,
    memberId: row.member_id,
    applicationId: row.application_id,
    toEmail: row.to_email,
    kind: row.kind,
    revision: row.revision,
    status: row.status,
    attempts: row.attempts,
    lastError: row.last_error,
    claimedAt: row.claimed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    payload: row.payload ?? {},
  };
}

function rpcError(error: unknown): Error {
  return new Error(typeof error === "object" ? JSON.stringify(error) : String(error));
}

function safeSiteUrl(): string | undefined {
  try {
    return siteUrl();
  } catch {
    return undefined;
  }
}

function buildDeps(supabase: SupabaseClient, secret: string): SendPendingDispatchesDeps {
  const organizer = smtpConfigured() ? fromAddress() : "stayovers@lyanne-visa.local";
  const appUrl = safeSiteUrl();

  return {
    claim: async (batchSize) => {
      const { data, error } = await supabase.rpc("claim_pending_dispatches", {
        p_secret: secret,
        p_limit: batchSize,
      });
      if (error) throw rpcError(error);
      return ((data ?? []) as DbDispatchRow[]).map(mapRow);
    },
    record: async (dispatchId, status, error) => {
      const { data, error: rpcErr } = await supabase.rpc("record_dispatch_outcome", {
        p_secret: secret,
        p_dispatch_id: dispatchId,
        p_status: status,
        p_error: error ?? null,
      });
      if (rpcErr) throw rpcError(rpcErr);
      const row = (Array.isArray(data) ? data[0] : data) as DbDispatchRow | undefined;
      if (!row) throw new Error(`record_dispatch_outcome returned no row for ${dispatchId}`);
      return mapRow(row);
    },
    render: (dispatch) => renderDispatch(dispatch, { organizer, appUrl }),
    mailer: getMailer(),
    isSuperseded: async (dispatch) => {
      if (!dispatch.applicationId) return false;
      const { data, error } = await supabase.rpc("dispatch_is_superseded", {
        p_secret: secret,
        p_application: dispatch.applicationId,
        p_revision: dispatch.revision,
      });
      if (error) throw rpcError(error);
      return Boolean(data);
    },
  };
}

/**
 * Real-world entry point for task 4.2's send loop. Returns `null` (a no-op,
 * never a throw) when `DELIVERY_WORKER_SECRET` isn't configured yet — the
 * owner's setup.md step the app can run happily without until it's done.
 */
export async function sendPendingDispatchesFromRequest(
  supabase: SupabaseClient,
  batchSize: number = DEFAULT_BATCH_SIZE,
): Promise<SendPendingDispatchesResult | null> {
  let secret: string;
  try {
    secret = deliveryWorkerSecret();
  } catch {
    console.info("[delivery] DELIVERY_WORKER_SECRET not set — skipping delivery retry.");
    return null;
  }

  return sendPendingDispatches(batchSize, buildDeps(supabase, secret));
}

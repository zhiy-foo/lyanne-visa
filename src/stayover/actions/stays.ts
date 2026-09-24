"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult, DateRange } from "@/ui/types";
import { createClient } from "../supabase/server";
import { mapDbError } from "../errors";
import { isValidDateRange, formatDayMonth } from "@/ui/format";
import { loadPlaceCapacityStatus } from "../data/stays";
import {
  buildApplicationDeletedEvent,
  buildMoveCommittedEvent,
  type DeleteApplicationResult,
  type MoveCommitResult,
  type StayoverEvent,
} from "../events";
import { participants } from "../events.server";

// Server actions for tasks 5.1 (parent) and 5.2 (host) — one file because
// record_move is one function for every kind regardless of side (design
// Decision 3), and the actions here mirror that shape rather than
// duplicating open/propose/accept/reject/cancel per side.
//
// Task 4.2 wiring: every successful move/delete builds its StayoverEvent
// (see ../events.ts) after the database call commits, via emitStayoverEvent
// below. There is no consumer yet (email-delivery, built alongside this
// change, will read this port later) — for now the event is only logged,
// never sent anywhere, and a failure to build/log it must never fail the
// action that already committed (spec "Emitting this event SHALL NOT block
// or fail the move or the delete that triggered it").
function emitStayoverEvent(event: StayoverEvent): void {
  // No consumer yet — see the module comment above. This is deliberately
  // not console.error (it is not a failure) and deliberately not a no-op
  // (the port must visibly fire so it's easy to verify from server logs
  // during development, and easy for email-delivery to swap this body for
  // a real send later).
  console.info("[stayover event]", event.kind, event);
}

async function fetchDisplayFacts(
  applicationId: string,
): Promise<{ childName: string; placeName: string; placeTimeZone: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_applications");
  if (error) return null;
  const row = (
    (data ?? []) as { application_id: string; child_name: string; place_name: string; place_time_zone: string }[]
  ).find((r) => r.application_id === applicationId);
  if (!row) return null;
  return { childName: row.child_name, placeName: row.place_name, placeTimeZone: row.place_time_zone };
}

async function emitMoveCommitted(result: MoveCommitResult): Promise<void> {
  const facts = await fetchDisplayFacts(result.application_id);
  if (!facts) return; // best-effort — never blocks the action (spec)
  emitStayoverEvent(buildMoveCommittedEvent(result, facts.childName, facts.placeName, facts.placeTimeZone));
}

function revalidateStayPaths(applicationId?: string) {
  revalidatePath("/overview");
  revalidatePath("/applications");
  if (applicationId) revalidatePath(`/applications/${applicationId}`);
}

// -- Parent-only ------------------------------------------------------------

/** spec "Parents open an application" — the first PROPOSE move (rule 3). */
export async function openApplication(
  childId: string,
  placeId: string,
  dates: DateRange,
  note?: string,
): Promise<ActionResult> {
  if (!isValidDateRange(dates)) {
    return { ok: false, message: "The pick-up day must be after the drop-off day." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("open_application", {
    p_child: childId,
    p_place: placeId,
    p_date_start: dates.start,
    p_date_end: dates.end,
    p_note: note ?? null,
  });
  if (error) return { ok: false, message: mapDbError(error) };

  const row = (data ?? [])[0] as
    | { application_id: string; move_id: string; child_id: string; place_id: string; kind: string; side: string; by: string; at: string; date_start: string; date_end: string; note: string | null; status_after: string }
    | undefined;
  if (row) {
    await emitMoveCommitted({
      move_id: row.move_id,
      application_id: row.application_id,
      child_id: row.child_id,
      place_id: row.place_id,
      kind: row.kind,
      side: row.side,
      by: row.by,
      at: row.at,
      date_start: row.date_start,
      date_end: row.date_end,
      note: row.note,
      status_after: row.status_after,
    });
  }

  revalidateStayPaths();
  return { ok: true };
}

/** rule 13 — hard delete only while unanswered. Reads participants first
 * (design.md Decision 7's note: the row is gone after delete_application
 * runs, so anything the event needs must be read before it). */
export async function deleteApplication(applicationId: string): Promise<ActionResult> {
  const before = await participants(applicationId).catch(() => []);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_application", { p_application: applicationId });
  if (error) return { ok: false, message: mapDbError(error) };

  const row = (data ?? [])[0] as DeleteApplicationResult | undefined;
  if (row) {
    const hosts = before.filter((p) => p.side === "host");
    emitStayoverEvent(buildApplicationDeletedEvent(applicationId, row, hosts));
  }

  revalidateStayPaths(applicationId);
  return { ok: true };
}

// -- Either side --------------------------------------------------------------

async function recordMove(
  applicationId: string,
  kind: "propose" | "accept" | "reject" | "cancel",
  dates?: DateRange,
  note?: string,
): Promise<ActionResult> {
  if (kind === "propose" && (!dates || !isValidDateRange(dates))) {
    return { ok: false, message: "The pick-up day must be after the drop-off day." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_move", {
    p_application: applicationId,
    p_kind: kind,
    p_date_start: dates?.start ?? null,
    p_date_end: dates?.end ?? null,
    p_note: note ?? null,
  });
  if (error) return { ok: false, message: mapDbError(error) };

  const row = (data ?? [])[0] as MoveCommitResult | undefined;
  if (row) await emitMoveCommitted(row);

  revalidateStayPaths(applicationId);
  return { ok: true };
}

/** "Suggest other dates" — an opening counter-proposal from either side. */
export async function proposeMove(applicationId: string, dates: DateRange, note?: string): Promise<ActionResult> {
  return recordMove(applicationId, "propose", dates, note);
}

export async function acceptMove(applicationId: string): Promise<ActionResult> {
  return recordMove(applicationId, "accept");
}

/** UI kind 'decline' maps to the database's 'reject' (src/ui/types.ts's
 * Move.kind predates the database's naming, same rename as the Phase
 * 'rejected' -> 'declined' mapping in ../data/stays.ts). */
export async function declineMove(applicationId: string, note?: string): Promise<ActionResult> {
  return recordMove(applicationId, "reject", undefined, note);
}

export async function cancelMove(applicationId: string, note?: string): Promise<ActionResult> {
  return recordMove(applicationId, "cancel", undefined, note);
}

/** design Decision 5's pre-submit capacity read: PlanStay's `capacityWarning`
 * prop is synchronous (src/ui/types.ts), so the client wrapper
 * (src/app/applications/new/PlanStayClient.tsx) calls this server action and
 * caches the result — this is the read itself, not a refusal (proposals are
 * never blocked for capacity, only accepts are). */
export async function checkCapacityWarning(
  placeId: string,
  placeName: string,
  dates: DateRange,
): Promise<string | undefined> {
  if (!placeId || !isValidDateRange(dates)) return undefined;
  const nights = await loadPlaceCapacityStatus(placeId, dates).catch(() => []);
  const fullNight = nights.find((n) => n.at_capacity);
  if (!fullNight) return undefined;
  return `${placeName} may already be full on ${formatDayMonth(fullNight.night)}.`;
}

// -- Host-only ----------------------------------------------------------------

/** design Decision 5's "Optional home capacity" write — blank/undefined
 * clears the limit. */
export async function setPlaceCapacity(placeId: string, capacity: number | null): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_place_capacity", { p_place: placeId, p_capacity: capacity });
  if (error) return { ok: false, message: mapDbError(error) };

  revalidatePath("/home");
  return { ok: true };
}

import "server-only";
import { createClient } from "./supabase/server";
import type { CalendarFacts, Participant, Phase, DateRange } from "./events";
export type { CalendarFacts } from "./events";

// The two Supabase-backed reads ARCHITECTURE.md §8 names as ports to
// Delivery. Split out from ./events.ts (which stays pure/no Supabase import)
// so the event-shape builders there remain plain-unit-testable.

type ParticipantRow = { member_id: string; name: string; email: string; side: "parent" | "host" };

/** ARCHITECTURE.md §8 `participants` — a deduced read, via
 * `application_participants` (20260924001000_stays_reads.sql), since
 * `member_select`/`place_host_select` RLS would otherwise hide the other
 * side's member row from the caller. */
export async function participants(applicationId: string): Promise<Participant[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("application_participants", { p_application: applicationId });
  if (error) throw new Error(typeof error === "object" ? JSON.stringify(error) : String(error));
  return ((data ?? []) as ParticipantRow[]).map((row) => ({
    memberId: row.member_id,
    name: row.name,
    email: row.email,
    side: row.side,
  }));
}

type ApplicationRow = {
  application_id: string;
  child_id: string;
  child_name: string;
  place_id: string;
  place_name: string;
  place_time_zone: string;
  status: string;
  awaiting: string | null;
  agreed_start: string | null;
  agreed_end: string | null;
  revision: number;
};

/** ARCHITECTURE.md §8 `calendarFacts` — everything Delivery needs to build a
 * calendar event, via `my_applications` (the caller must still be a
 * participant to read it). */
export async function calendarFacts(applicationId: string): Promise<CalendarFacts | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_applications");
  if (error) throw new Error(typeof error === "object" ? JSON.stringify(error) : String(error));
  const row = ((data ?? []) as ApplicationRow[]).find((r) => r.application_id === applicationId);
  if (!row) return null;
  const agreed: DateRange | null =
    row.agreed_start && row.agreed_end ? { start: row.agreed_start, end: row.agreed_end } : null;
  return {
    agreed,
    revision: row.revision,
    phase: row.status as Phase,
    placeTimeZone: row.place_time_zone,
    childName: row.child_name,
    placeName: row.place_name,
  };
}

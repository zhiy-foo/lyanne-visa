// Pure types and builders for the `StayoverEvent` port (design.md Decision
// 7; ARCHITECTURE.md §8) — deliberately free of "server-only"/Supabase
// imports so these are plain-unit-testable; the two Supabase-backed reads
// (`participants`, `calendarFacts`) live in ./events.server.ts.
//
// The `StayoverEvent` port (design.md Decision 7; ARCHITECTURE.md §8): a
// same-invocation return value, never stored anywhere and never sent by
// anything in this change — `email-delivery` (a separate, concurrently-built
// change) is the only intended consumer. Keep this type's shape stable; it
// is exported for that change to import.
//
// email-delivery's own design.md owns the exact field list it needs beyond
// this — this file only guarantees the port exists and fires after commit
// (spec "Stayover events are emitted for delivery").

export type Side = "parent" | "host";
export type MoveKind = "propose" | "accept" | "reject" | "cancel";
export type Phase = "negotiating" | "confirmed" | "rejected" | "cancelled";
export type DateRange = { start: string; end: string };

/** ARCHITECTURE.md §8 `participants`: active members of
 * guardians(a_child) ∪ hosts(a_place). */
export type Participant = { memberId: string; name: string; email: string; side: Side };

export type MoveRecord = {
  id: string;
  kind: MoveKind;
  side: Side;
  by: string; // member id (audit — mv_by)
  at: string; // ISO datetime
  dates?: DateRange; // defined iff kind === 'propose'
  note?: string;
};

export type ApplicationSnapshot = {
  id: string;
  childId: string;
  childName: string;
  placeId: string;
  placeName: string;
  placeTimeZone: string;
};

export type StayoverEvent =
  | {
      kind: "MoveCommitted";
      application: ApplicationSnapshot;
      move: MoveRecord;
      before: Phase;
      after: Phase;
    }
  | {
      kind: "ApplicationDeleted";
      applicationId: string;
      childName: string;
      placeName: string;
      hosts: Participant[];
      dates: DateRange | null;
    };

/** Shape common to `record_move`/`open_application`'s RPC result rows —
 * enough to build a `MoveCommitted` event without a second read (design.md
 * Decision 7: "return enough for the calling server action to build the
 * event in-process"). */
export type MoveCommitResult = {
  move_id: string;
  application_id: string;
  child_id: string;
  place_id: string;
  kind: string;
  side: string;
  by: string;
  at: string;
  date_start: string | null;
  date_end: string | null;
  note: string | null;
  status_before?: string; // open_application has no "before" — it creates the application
  status_after: string;
};

/** Builds the `MoveCommitted` event from a successful `record_move`/
 * `open_application` RPC result, plus the child/place display facts (a
 * separate read since neither RPC returns them — see calendarFacts). Never
 * called on a failed call (task 4.2's "a failed move never produces an
 * event"). */
export function buildMoveCommittedEvent(
  result: MoveCommitResult,
  childName: string,
  placeName: string,
  placeTimeZone: string,
): Extract<StayoverEvent, { kind: "MoveCommitted" }> {
  return {
    kind: "MoveCommitted",
    application: {
      id: result.application_id,
      childId: result.child_id,
      childName,
      placeId: result.place_id,
      placeName,
      placeTimeZone,
    },
    move: {
      id: result.move_id,
      kind: result.kind as MoveKind,
      side: result.side as Side,
      by: result.by,
      at: result.at,
      dates:
        result.date_start && result.date_end ? { start: result.date_start, end: result.date_end } : undefined,
      note: result.note ?? undefined,
    },
    // open_application has no "before" state (the application did not exist
    // yet); treat it as its own initial phase for a total type.
    before: (result.status_before as Phase) ?? "negotiating",
    after: result.status_after as Phase,
  };
}

/** Shape of `delete_application`'s RPC result row. */
export type DeleteApplicationResult = {
  child_name: string;
  place_name: string;
  host_member_ids: string[];
  agreed_start: string | null;
  agreed_end: string | null;
  open_start: string | null;
  open_end: string | null;
};

/** Builds the `ApplicationDeleted` event from `delete_application`'s
 * snapshot — the row is already gone by the time this runs, which is why
 * `delete_application` returns everything needed up front (design.md
 * Decision 6). `hosts` here carries only the ids the function returned;
 * callers that need full participant records should read them via
 * `participants` *before* calling delete (the row still exists then). */
export function buildApplicationDeletedEvent(
  applicationId: string,
  result: DeleteApplicationResult,
  hosts: Participant[],
): Extract<StayoverEvent, { kind: "ApplicationDeleted" }> {
  const dates =
    result.agreed_start && result.agreed_end
      ? { start: result.agreed_start, end: result.agreed_end }
      : result.open_start && result.open_end
        ? { start: result.open_start, end: result.open_end }
        : null;

  return {
    kind: "ApplicationDeleted",
    applicationId,
    childName: result.child_name,
    placeName: result.place_name,
    hosts,
    dates,
  };
}

/** ARCHITECTURE.md §8 `calendarFacts`'s return shape — the type lives here
 * (pure) even though the read itself (events.server.ts) needs Supabase. */
export type CalendarFacts = {
  agreed: DateRange | null;
  revision: number;
  phase: Phase;
  placeTimeZone: string;
  placeAddress?: string;
  childName: string;
  placeName: string;
};

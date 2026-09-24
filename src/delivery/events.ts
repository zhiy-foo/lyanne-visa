// Delivery's own event/domain types (tasks 3.1, 3.4; ARCHITECTURE.md §4, §5,
// §8). Kept separate from `src/stayover/events.ts` on purpose — this file's
// header comment already documents why (`Delivery ... never imports
// src/stayover/ types directly for its own domain objects`). ARCHITECTURE.md
// §8 defines `StayoverEvent = MoveCommitted ⊕ ApplicationDeleted ⊕
// MemberWaiting`; `src/stayover/events.ts`'s own `StayoverEvent` only has the
// first two (MemberWaiting comes from foundation's `register`, not `stays`)
// — so Delivery needs its own, slightly wider copy of the type to match
// ARCHITECTURE.md's boundary exactly. This file is pure (no Supabase, no
// "server-only") so `planDelivery` stays plain-unit-testable per tasks.md
// 3.4.

export type Side = "parent" | "host";
export type MoveKind = "propose" | "accept" | "reject" | "cancel";
export type Phase = "negotiating" | "confirmed" | "rejected" | "cancelled";
export type DateRange = { start: string; end: string };

export type StayoverEvent =
  | {
      kind: "MoveCommitted";
      applicationId: string;
      childName: string;
      placeName: string;
      moveKind: MoveKind;
      side: Side; // who made this move
      moverName: string;
      note?: string;
      /** The proposed dates (propose), or the now-agreed dates (accept). */
      dates?: DateRange;
      /** `awaiting` side after this move (design Decision d/table §5), when defined. */
      awaitingAfter?: Side;
      /** The side whose open proposal this move answered (accept/reject only). */
      answeredSide?: Side;
      /** True iff `agreed?` existed before this move (needed for cancel's invite-or-not). */
      hadAgreementBefore: boolean;
    }
  | {
      kind: "ApplicationDeleted";
      applicationId: string;
      childName: string;
      placeName: string;
      dates?: DateRange;
    }
  | {
      kind: "MemberWaiting";
      personName: string;
      role: Side;
    };

export type PlannedDispatchKind = "notice" | "invite";

export interface PlannedDispatch {
  kind: PlannedDispatchKind;
  /** 'parent' | 'host' | 'admin' — planDelivery names *which side*, not the
   * resolved member list (that's `participants`/`stayover_side_members`'s job). */
  recipientSide: Side | "admin";
  /** `REQUEST`/`CANCEL` for an invite; undefined for a notice. */
  method?: "REQUEST" | "CANCEL";
}

/**
 * `planDelivery : StayoverEvent → PlannedDispatch*` (ARCHITECTURE.md §5's
 * table, tasks.md 3.4) — a pure function used only to cross-check that the
 * SQL-side queuing in 20260924001200_delivery_queue.sql matches the same
 * plan; not called at runtime (the SQL functions already queue the rows
 * inside the same transaction as the domain write, per design.md Decision
 * a — see that migration's header comment for why).
 */
export function planDelivery(event: StayoverEvent): PlannedDispatch[] {
  if (event.kind === "MemberWaiting") {
    return [{ kind: "notice", recipientSide: "admin" }];
  }

  if (event.kind === "ApplicationDeleted") {
    return [{ kind: "notice", recipientSide: "host" }];
  }

  // MoveCommitted
  const plans: PlannedDispatch[] = [];
  switch (event.moveKind) {
    case "propose": {
      if (event.awaitingAfter) plans.push({ kind: "notice", recipientSide: event.awaitingAfter });
      break;
    }
    case "accept": {
      if (event.answeredSide) plans.push({ kind: "notice", recipientSide: event.answeredSide });
      plans.push({ kind: "invite", recipientSide: "parent", method: "REQUEST" });
      plans.push({ kind: "invite", recipientSide: "host", method: "REQUEST" });
      break;
    }
    case "reject": {
      if (event.answeredSide) plans.push({ kind: "notice", recipientSide: event.answeredSide });
      break;
    }
    case "cancel": {
      const other: Side = event.side === "parent" ? "host" : "parent";
      plans.push({ kind: "notice", recipientSide: other });
      if (event.hadAgreementBefore) {
        plans.push({ kind: "invite", recipientSide: "parent", method: "CANCEL" });
        plans.push({ kind: "invite", recipientSide: "host", method: "CANCEL" });
      }
      break;
    }
  }
  return plans;
}

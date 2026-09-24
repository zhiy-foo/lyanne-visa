// Client-side mirror of record_move's legality/overlap/capacity checks
// (design.md task 2.6; ARCHITECTURE.md §5-6 rules 2, 4, 6; design Decision
// 4). Pure — no writes, no Supabase import — used only to enable/disable UI
// controls (Law 6 placement: Browser for UX, AppServer/Db for authority).
// The database call inside record_move is what actually enforces every one
// of these; this file must never be trusted as the refusal itself.

export type Side = "parent" | "host";
export type MoveKind = "propose" | "accept" | "reject" | "cancel" | "delete";
// Matches src/ui/types.ts's Phase ('declined', not the database's 'rejected'
// — the mapping happens once, in the data loader).
export type Phase = "negotiating" | "confirmed" | "declined" | "cancelled";
export type DateRange = { start: string; end: string };

export type ApplicationState = {
  phase: Phase;
  awaiting?: Side;
  /** Rule 13: a parent may hard-delete only while every move's side is
   * 'parent' — i.e. no host has moved on it yet. */
  hostHasAnswered: boolean;
};

export type ValidateMoveResult = { ok: true } | { ok: false; message: string };

const TERMINAL: Phase[] = ["declined", "cancelled"];

function overlaps(a: DateRange, b: DateRange): boolean {
  // Half-open ranges [start, end) — rule 6.
  return a.start < b.end && b.start < a.end;
}

/** Optional context for the `accept` kind only — mirrors design Decision
 * 4's overlap (rule 6) and capacity checks against already-loaded state.
 * Omitted fields simply skip that half of the check (the server call is
 * always the authority, so under-informing the client only means a refusal
 * surfaces one round trip later, not that anything is bypassed). */
export type AcceptContext = {
  /** The dates that would be agreed if this accept succeeds (the open
   * proposal's dates). */
  proposedDates?: DateRange;
  /** This child's other applications' currently agreed? ranges. */
  otherAgreedRangesForChild?: DateRange[];
  /** Per-night agreed counts at the place (place_capacity_status shape),
   * already excluding this application. */
  capacityStatus?: { night: string; agreedCount: number; capacity: number | null }[];
};

/**
 * Mirrors record_move's legality table (rule 4), plus — for `accept` only,
 * when `context` is supplied — the overlap (rule 6) and capacity (design
 * Decision 4) checks. Never performs a write.
 */
export function validateMove(
  state: ApplicationState,
  viewerSide: Side,
  kind: MoveKind,
  context?: AcceptContext,
): ValidateMoveResult {
  if (kind === "delete") {
    if (viewerSide !== "parent") {
      return { ok: false, message: "Only this child's parents can delete an application." };
    }
    if (state.hostHasAnswered) {
      return { ok: false, message: "A host has responded — cancel it instead of deleting it." };
    }
    return { ok: true };
  }

  if (TERMINAL.includes(state.phase)) {
    return { ok: false, message: "This application is already declined or cancelled." };
  }

  if (kind === "accept" || kind === "reject") {
    if (state.awaiting === undefined) {
      return { ok: false, message: "There is nothing open to answer." };
    }
    if (state.awaiting !== viewerSide) {
      return { ok: false, message: "You cannot answer your own proposal." };
    }
    if (kind === "accept" && context) {
      const check = checkAcceptOverlapAndCapacity(context);
      if (!check.ok) return check;
    }
    return { ok: true };
  }

  if (kind === "cancel") {
    return { ok: true };
  }

  // propose (opening or counter-proposal): allowed while non-terminal,
  // except while it is already the other side's turn to answer your own
  // open proposal — proposing again then would silently replace it, which
  // the UI intentionally disables (record_move itself has no such
  // restriction; this is a UX-only narrowing of an otherwise-legal move).
  if (state.awaiting !== undefined && state.awaiting !== viewerSide) {
    return { ok: false, message: "Wait for an answer before suggesting new dates." };
  }
  return { ok: true };
}

function checkAcceptOverlapAndCapacity(context: AcceptContext): ValidateMoveResult {
  const { proposedDates, otherAgreedRangesForChild, capacityStatus } = context;

  if (proposedDates && otherAgreedRangesForChild) {
    const conflict = otherAgreedRangesForChild.some((range) => overlaps(proposedDates, range));
    if (conflict) {
      return { ok: false, message: "These dates overlap another confirmed stay for this child." };
    }
  }

  if (proposedDates && capacityStatus) {
    const relevant = capacityStatus.filter(
      (n) => n.night >= proposedDates.start && n.night < proposedDates.end,
    );
    const overCapacity = relevant.some((n) => n.capacity !== null && n.agreedCount + 1 > n.capacity);
    if (overCapacity) {
      return {
        ok: false,
        message: "That would put more children at this home on one night than its capacity allows.",
      };
    }
  }

  return { ok: true };
}

export type Can = { accept: boolean; decline: boolean; propose: boolean; cancel: boolean; delete: boolean };

/** The `can` flags ApplicationDetailProps needs — one call per phase/side
 * combination, matching §5's state table (used by the detail loader, task
 * 5.3). `context` is only meaningful for `accept`. */
export function computeCan(state: ApplicationState, viewerSide: Side, context?: AcceptContext): Can {
  return {
    accept: validateMove(state, viewerSide, "accept", context).ok,
    decline: validateMove(state, viewerSide, "reject").ok,
    propose: validateMove(state, viewerSide, "propose").ok,
    cancel: validateMove(state, viewerSide, "cancel").ok,
    delete: validateMove(state, viewerSide, "delete").ok,
  };
}

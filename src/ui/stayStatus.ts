// Shared status-badge, banner and history copy for the stays screens
// (Overview, Applications, ApplicationDetail) — one place implementing
// ui-design-brief.md §4's status table so the three screens can't drift out
// of sync with each other. Pure functions only, no React.
import type { BadgeVariant } from "./Badge";
import type { BannerVariant } from "./Banner";
import type { DateRange, Move, Phase, Side } from "./types";
import { formatDateRange } from "./format";

export type StatusSubject = {
  phase: Phase;
  awaiting?: Side;
  viewerSide: Side;
};

/** True when the application is open (not declined/cancelled) and it is the
 * viewer's turn to answer. */
export function needsViewerAnswer(stay: StatusSubject): boolean {
  if (stay.phase === "declined" || stay.phase === "cancelled") return false;
  return stay.awaiting === stay.viewerSide;
}

export type StatusInfo = { variant: BadgeVariant; icon: string; label: string };

/** ui-design-brief.md §4's status table, both viewer sides. `placeName` is
 * only used for the "waiting for hosts" wording, per "words come from data
 * ... don't hard-code them". */
export function statusInfo(stay: StatusSubject & { placeName: string }): StatusInfo {
  const { phase, awaiting, viewerSide, placeName } = stay;

  if (phase === "declined") return { variant: "neutral", icon: "✕", label: "Declined" };
  if (phase === "cancelled") return { variant: "neutral", icon: "–", label: "Cancelled" };

  if (phase === "confirmed") {
    if (awaiting === viewerSide) {
      return { variant: "attention", icon: "!", label: "Confirmed · your answer needed" };
    }
    if (awaiting) {
      return { variant: "confirmed", icon: "✓", label: "Confirmed · change requested" };
    }
    return { variant: "confirmed", icon: "✓", label: "Confirmed" };
  }

  // negotiating
  if (awaiting === viewerSide) return { variant: "attention", icon: "!", label: "Your answer needed" };
  if (awaiting === "host") return { variant: "neutral", icon: "…", label: `Waiting for ${placeName}` };
  if (awaiting === "parent") return { variant: "neutral", icon: "…", label: "Waiting for the parents" };
  return { variant: "neutral", icon: "…", label: "Negotiating" };
}

export type StatusBanner = { variant: BannerVariant; title: string; body: string };

/** The plain-words status banner at the top of ApplicationDetail: what's
 * happening, and what (if anything) the viewer must do. */
export function statusBanner(
  stay: StatusSubject & { placeName: string; childName: string },
): StatusBanner {
  const { phase, awaiting, viewerSide, placeName, childName } = stay;

  if (phase === "declined") {
    return {
      variant: "neutral",
      title: "Declined",
      body: "This application was declined and is now closed.",
    };
  }
  if (phase === "cancelled") {
    return {
      variant: "neutral",
      title: "Cancelled",
      body: "This stay was cancelled and its dates are no longer agreed.",
    };
  }

  if (phase === "confirmed") {
    if (awaiting === viewerSide) {
      return {
        variant: "attention",
        title: "A change has been suggested",
        body: "The stay is still confirmed on its earlier dates, but new dates have been suggested — your answer is needed.",
      };
    }
    if (awaiting) {
      return {
        variant: "neutral",
        title: "Confirmed · change requested",
        body: "The stay is confirmed. You've suggested new dates and are waiting for an answer.",
      };
    }
    return {
      variant: "neutral",
      title: "Confirmed",
      body: `${childName}'s stay at ${placeName} is confirmed.`,
    };
  }

  // negotiating
  if (awaiting === viewerSide) {
    return {
      variant: "attention",
      title: "Your answer needed",
      body: "Accept these dates, suggest others, or decline.",
    };
  }
  const otherSide = awaiting === "host" ? placeName : "the parents";
  return {
    variant: "neutral",
    title: "Waiting for an answer",
    body: `Waiting for ${otherSide} to answer.`,
  };
}

export type StayGroup = "needs-answer" | "upcoming" | "past";

/** Groups a stay for the Applications list: needs-your-answer first, then
 * still-open/upcoming, then past & closed (declined, cancelled, or a
 * confirmed stay whose pick-up day has already gone by). */
export function categorizeStay(
  stay: StatusSubject & { dates: DateRange },
  today: string,
): StayGroup {
  if (needsViewerAnswer(stay)) return "needs-answer";
  if (stay.phase === "declined" || stay.phase === "cancelled") return "past";
  if (stay.phase === "confirmed" && stay.dates.end < today) return "past";
  return "upcoming";
}

/** A plain-language sentence for one history entry, e.g. "Mum asked for
 * Fri 3 Oct → Tue 7 Oct", "Grandma suggested Sat 4 Oct → Tue 7 Oct — 'She
 * can't do Friday'", "Mum accepted". `isFirst` distinguishes the opening
 * proposal ("asked for") from a later counter-proposal ("suggested"). */
export function describeMove(move: Move, isFirst: boolean): string {
  const { kind, byName, dates, note } = move;
  const noteSuffix = note ? ` — “${note}”` : "";

  switch (kind) {
    case "propose": {
      const verb = isFirst ? "asked for" : "suggested";
      const range = dates ? formatDateRange(dates) : "new dates";
      return `${byName} ${verb} ${range}${noteSuffix}`;
    }
    case "accept":
      return `${byName} accepted`;
    case "decline":
      return `${byName} declined${noteSuffix}`;
    case "cancel":
      return `${byName} cancelled${noteSuffix}`;
    default:
      return `${byName} made a move`;
  }
}

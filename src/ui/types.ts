// Shared types for src/ui — presentational components only.
// See docs/stayover/general/ui-design-brief.md §4–5 for the source contract.
// These types must not be renamed or have required fields removed; screens
// may add optional presentational props alongside them.

import type { ReactNode } from "react";

export type Side = "parent" | "host";

// retryAfterSeconds is optional on both variants: most actions never set it,
// but requestSignInLink (SignIn) uses it to drive a cooldown countdown on
// success (so a double-click can't hit the rate limit) and on a rate-limit
// failure (so the person sees when they can try again).
export type ActionResult =
  | { ok: true; retryAfterSeconds?: number }
  | { ok: false; message: string; retryAfterSeconds?: number };

export type Person = { id: string; name: string; email: string };

// ---------------------------------------------------------------------------
// Stage 1 — sign-in, registration and accounts
// ---------------------------------------------------------------------------

export type SignInProps = {
  error?: "link-expired" | "google-cancelled" | "generic" | "account-unavailable";
  onRequestLink(email: string): Promise<ActionResult>;
  onGoogle(): void;
  // Optional: when provided, rendered in place of the default "Sign in with
  // Google" button (onGoogle is still required for callers that don't pass
  // one, e.g. the dev gallery fixtures). Lets SignInClient.tsx swap in
  // src/app/sign-in/GoogleSignIn.tsx (Google Identity Services) without
  // src/ui importing anything Supabase-related.
  googleSlot?: ReactNode;
};

export type RegisterProps = {
  email: string;
  codeAttemptsLeft: number; // 0 => hide the code field, waiting list only
  onRegister(role: Side, name: string, code?: string): Promise<ActionResult>;
  onSignOut(): void;
};

export type WaitingProps = { name: string; email: string; onSignOut(): void };

export type DeactivatedProps = { email: string; onSignOut(): void };

export type ParentHomeProps = {
  me: { name: string; email: string };
  children: {
    id: string;
    name: string;
    parents: { id: string; name: string; email: string }[];
  }[];
  homes: { id: string; name: string; timeZone: string }[]; // directory: no addresses
  onAddChild(name: string): Promise<ActionResult>;
  onRenameChild(childId: string, name: string): Promise<ActionResult>;
  onAddCoParent(childId: string, email: string): Promise<ActionResult>;
  onRemoveParent(childId: string, memberId: string): Promise<ActionResult>;
};

export type HostHomeProps = {
  me: { name: string; email: string };
  homes: {
    id: string;
    name: string;
    address?: string;
    timeZone: string;
    hosts: { id: string; name: string; email: string }[];
  }[];
  timeZones: string[];
  onAddHome(input: {
    name: string;
    address?: string;
    timeZone: string;
  }): Promise<ActionResult>;
  onUpdateHome(
    homeId: string,
    input: { name: string; address?: string; timeZone: string },
  ): Promise<ActionResult>;
  onAddCoHost(homeId: string, email: string): Promise<ActionResult>;
  onRemoveHost(homeId: string, memberId: string): Promise<ActionResult>;
};

// Shared across the three admin screens (AdminAccounts, AdminChildren,
// AdminHomes — the admin area is split across /admin/accounts,
// /admin/children and /admin/homes, one screen per route).
export type AdminAccount = {
  id: string;
  name: string;
  email: string;
  role: Side;
  status: "waiting" | "active" | "deactivated";
  registeredAt: string; // ISO datetime
  childIds: string[];
  homeIds: string[];
  // Only meaningful (and only ever true) for a deactivated account: it has
  // no history (no links, created nothing) so the admin may delete it for
  // good (ARCHITECTURE.md §6 rule 17 exception). Absent/false elsewhere.
  deletable?: boolean;
};

export type AdminChild = { id: string; name: string; parentIds: string[] };

export type AdminHome = {
  id: string;
  name: string;
  address?: string;
  timeZone: string;
  hostIds: string[];
};

export type AdminAccountsProps = {
  accounts: AdminAccount[];
  joinCodeSet: boolean;
  onApprove(accountId: string): Promise<ActionResult>;
  onDecline(accountId: string): Promise<ActionResult>;
  onSetJoinCode(code: string | null): Promise<ActionResult>; // null clears it
  onDeactivate(accountId: string): Promise<ActionResult>;
  onReactivate(accountId: string): Promise<ActionResult>;
  onSetRole(accountId: string, role: Side): Promise<ActionResult>; // only when unlinked
  onDelete(accountId: string): Promise<ActionResult>; // only when account.deletable
};

export type AdminChildrenProps = {
  children: AdminChild[];
  accounts: AdminAccount[]; // to list/link parents
  onRenameChild(childId: string, name: string): Promise<ActionResult>;
  onLinkParent(
    childId: string,
    accountId: string,
    linked: boolean,
  ): Promise<ActionResult>;
};

export type AdminHomesProps = {
  homes: AdminHome[];
  accounts: AdminAccount[]; // to list/link hosts
  timeZones: string[];
  onUpdateHome(
    homeId: string,
    input: { name: string; address?: string; timeZone: string },
  ): Promise<ActionResult>;
  onLinkHost(
    homeId: string,
    accountId: string,
    linked: boolean,
  ): Promise<ActionResult>;
};

// ---------------------------------------------------------------------------
// Stage 2 — applications and the back-and-forth
// (ui-design-brief.md §4–5; StayDetails/§stage-3 sections deliberately
// excluded per openspec/changes/stays/tasks.md 6.4)
// ---------------------------------------------------------------------------

export type DateRange = { start: string; end: string }; // ISO dates, e.g. '2026-10-03'
export type Phase = "negotiating" | "confirmed" | "declined" | "cancelled";

export type StaySummary = {
  id: string;
  childName: string;
  placeName: string;
  dates: DateRange; // agreed dates, or the dates currently proposed
  phase: Phase;
  awaiting?: Side; // whose turn, if anyone's
  viewerSide: Side;
};

// Renamed from ui-design-brief.md's `StaysHomeProps` to match this build's
// component name `Applications` — design-reference.md's nav (menu.png) shows
// Applications as its own screen, not embedded atop ParentHome/HostHome as
// the brief originally sketched for stage 1. Field names unchanged.
export type ApplicationsProps = {
  stays: StaySummary[];
  canCreate: boolean; // parents only
  /** Pins "today" for grouping upcoming vs. past confirmed stays; defaults to
   * the real date when omitted (tests pin it for determinism). */
  today?: string;
  onOpen(id: string): void;
  onNew(): void;
};

// Overview (design-reference.md: greeting, attention banner, month calendar,
// "Event brief" card) isn't in ui-design-brief.md's screen list — it is
// realised here from the reference screenshots (overview.png, event-brief.png).
// `OverviewStay` extends `StaySummary` with the one extra field the compact
// brief needs.
export type OverviewStay = StaySummary & {
  /** The latest move on this stay, when worth calling out on the compact
   * brief (e.g. a suggested-dates change), e.g.
   * { summary: "Grandma suggested other dates", note: "She can't do Friday." } */
  latestMove?: { summary: string; note?: string };
};

export type OverviewProps = {
  name: string;
  // No top-level viewerSide: each OverviewStay already carries its own
  // (from StaySummary), which is all needsViewerAnswer/pickFeaturedStay need.
  stays: OverviewStay[];
  /** ISO date; defaults to the real "today" when omitted (tests pin it to
   * make the calendar's initial month and the featured-stay pick deterministic). */
  today?: string;
  onOpen(applicationId: string): void;
};

// Renamed from ui-design-brief.md's `NewApplicationProps` to match this
// build's component name `PlanStay` (design-reference.md's nav: "Plan a
// stay"). Field names unchanged except the added `capacityWarning`, a pure
// synchronous prop realising design Decision 5's pre-submit capacity read —
// still presentational: the caller supplies already-loaded capacity data,
// this component never fetches it.
export type PlanStayProps = {
  children: { id: string; name: string }[];
  places: { id: string; name: string }[];
  templates: { id: string; name: string }[]; // stage 3; always empty here
  /** Given the chosen home and dates, returns a warning message when a night
   * in range is already at that home's capacity, or undefined when there's
   * none to show. */
  capacityWarning?(placeId: string, dates: DateRange): string | undefined;
  onSubmit(input: {
    childId: string;
    placeId: string;
    dates: DateRange;
    note?: string;
    templateId?: string;
  }): Promise<ActionResult>;
  onCancel(): void;
};

export type Move = {
  kind: "propose" | "accept" | "decline" | "cancel";
  side: Side;
  byName: string;
  at: string; // ISO datetime
  dates?: DateRange; // for 'propose'
  note?: string;
};

export type ApplicationDetailProps = {
  childName: string;
  placeName: string;
  viewerSide: Side;
  phase: Phase;
  awaiting?: Side;
  agreed?: DateRange; // confirmed dates, if any
  proposed?: DateRange; // open proposal waiting for an answer, if any
  history: Move[]; // oldest first
  can: { accept: boolean; decline: boolean; propose: boolean; cancel: boolean; delete: boolean };
  onAccept(): Promise<ActionResult>;
  onDecline(note?: string): Promise<ActionResult>;
  onPropose(dates: DateRange, note?: string): Promise<ActionResult>;
  onCancel(note?: string): Promise<ActionResult>;
  onDelete(): Promise<ActionResult>; // only while no host has answered
  // details?: StayDetailsProps — stage 3, deliberately excluded (tasks.md 6.4)
};

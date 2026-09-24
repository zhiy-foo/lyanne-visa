// Shared types for src/ui — presentational components only.
// See docs/stayover/general/ui-design-brief.md §4–5 for the source contract.
// These types must not be renamed or have required fields removed; screens
// may add optional presentational props alongside them.

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

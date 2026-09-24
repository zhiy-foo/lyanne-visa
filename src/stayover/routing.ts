// Pure routing decision (design.md Decision 5). No Supabase/Next imports —
// deliberately, so the state machine is trivially unit-testable and can be
// called from both src/proxy.ts (NextRequest cookies) and Server Components
// (next/headers cookies) without caring which one built the account.

export type MyAccount = {
  memberId: string | null;
  name: string | null;
  role: "parent" | "host" | null;
  status: "waiting" | "active" | "deactivated" | null;
  email: string;
  isAdmin: boolean;
  codeAttemptsLeft: number;
};

/** Shape of a `my_account()` row, before it is mapped to `MyAccount`. */
export type MyAccountRow = {
  member_id: string | null;
  name: string | null;
  role: "parent" | "host" | null;
  status: "waiting" | "active" | "deactivated" | null;
  email: string;
  is_admin: boolean;
  code_attempts_left: number;
};

export function mapMyAccountRow(row: MyAccountRow): MyAccount {
  return {
    memberId: row.member_id,
    name: row.name,
    role: row.role,
    status: row.status,
    email: row.email,
    isAdmin: row.is_admin,
    codeAttemptsLeft: row.code_attempts_left,
  };
}

/**
 * Outcome of a `my_account()` RPC call, kept separate from `MyAccount |
 * null` so a database/RPC error (e.g. the hosted database hasn't had its
 * migrations pushed yet) can be told apart from "signed in, no member row
 * yet" — the latter is a legitimate `null` (routes to /register), the
 * former must not be silently treated as one (see routeForAccountUnavailable
 * and design.md's account-unavailable error state).
 */
export type MyAccountOutcome =
  | { kind: "account"; account: MyAccount }
  | { kind: "none" }
  | { kind: "error" };

/**
 * Pure classification of a `my_account()` response — no Supabase types
 * beyond the plain data/error shape, so it is trivially unit-testable and
 * shared by src/proxy.ts, src/app/auth/callback/route.ts and
 * src/stayover/account.ts.
 */
export function classifyMyAccountRpc(
  data: MyAccountRow[] | null | undefined,
  error: unknown,
): MyAccountOutcome {
  if (error) return { kind: "error" };
  const row = data?.[0];
  return row ? { kind: "account", account: mapMyAccountRow(row) } : { kind: "none" };
}

const PUBLIC_PATHS = new Set(["/sign-in", "/auth/callback"]);

// An active member now has several allowed pages (Overview, Applications,
// Plan a stay, an application's detail, and /home for "My children"/"My
// home") rather than one fixed target — same shape as the admin area's
// "/admin or any /admin/*" special case below, generalised to this fixed
// set of stage-2 routes.
function isActiveMemberPath(pathname: string): boolean {
  return (
    pathname === "/overview" ||
    pathname === "/home" ||
    pathname === "/applications" ||
    pathname === "/applications/new" ||
    (pathname.startsWith("/applications/") && pathname !== "/applications/new")
  );
}

// Only called for non-admin, non-active accounts — routeFor handles the
// admin case (the admin area spans /admin and every /admin/* sub-page) and
// the active case (isActiveMemberPath, above) itself, since neither is a
// single fixed target the way every other state's page is.
function targetFor(account: MyAccount): string {
  if (account.status === "waiting") return "/waiting";
  if (account.status === "deactivated") return "/deactivated";
  return "/register";
}

/**
 * Decision 5's routing, applied on every page load so a deep link cannot
 * skip it: signed out -> /sign-in?next=<path> (except the public paths);
 * admin -> /admin (or any /admin/* sub-page — the admin area is split into
 * /admin/accounts, /admin/children and /admin/homes); active -> /home;
 * waiting -> /waiting; deactivated -> /deactivated; unregistered (signed
 * in, no member row, not admin) -> /register. Returns the path the caller
 * should redirect to, or `null` if `pathname` is already one this state is
 * allowed to see.
 *
 * `/dev/*` is intentionally not handled here — whether it is reachable
 * depends on `NODE_ENV`, which is an environment concern the caller (proxy)
 * owns, not this pure state machine.
 */
export function routeFor(account: MyAccount | null, pathname: string): string | null {
  if (account === null) {
    if (PUBLIC_PATHS.has(pathname)) return null;
    return `/sign-in?next=${encodeURIComponent(pathname)}`;
  }

  if (account.isAdmin) {
    return pathname === "/admin" || pathname.startsWith("/admin/") ? null : "/admin";
  }

  if (account.status === "active") {
    return isActiveMemberPath(pathname) ? null : "/overview";
  }

  const target = targetFor(account);
  return pathname === target ? null : target;
}

/**
 * Where src/proxy.ts should send someone who is signed in but whose account
 * couldn't be loaded (my_account() RPC errored — e.g. the hosted database
 * hasn't had its migrations pushed yet). Mirrors routeFor's redirect-loop
 * avoidance for the one path this lands on: null once already at /sign-in,
 * so the ?error=account-unavailable query string sticks instead of being
 * redirected away from itself.
 */
export function routeForAccountUnavailable(pathname: string): string | null {
  return pathname === "/sign-in" ? null : "/sign-in?error=account-unavailable";
}

/**
 * Where to send a person right after they finish signing in: `candidatePath`
 * (the `next` query param, honoured per the "Pages require sign-in" spec
 * scenario) if — and only if — `routeFor` says that account is actually
 * allowed to see it; otherwise the account's own routed destination. Refuses
 * anything that is not an absolute in-app path (no open redirects).
 */
export function resolveDestination(account: MyAccount | null, candidatePath: string | null): string {
  const safeCandidate =
    candidatePath && candidatePath.startsWith("/") && !candidatePath.startsWith("//")
      ? candidatePath
      : null;

  if (safeCandidate) {
    return routeFor(account, safeCandidate) ?? safeCandidate;
  }

  return routeFor(account, "/") ?? "/overview";
}

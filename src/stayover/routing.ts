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

const PUBLIC_PATHS = new Set(["/sign-in", "/auth/callback"]);

function targetFor(account: MyAccount): string {
  if (account.isAdmin) return "/admin";
  if (account.status === "active") return "/home";
  if (account.status === "waiting") return "/waiting";
  if (account.status === "deactivated") return "/deactivated";
  return "/register";
}

/**
 * Decision 5's routing, applied on every page load so a deep link cannot
 * skip it: signed out -> /sign-in?next=<path> (except the public paths);
 * admin -> /admin; active -> /home; waiting -> /waiting; deactivated ->
 * /deactivated; unregistered (signed in, no member row, not admin) ->
 * /register. Returns the path the caller should redirect to, or `null` if
 * `pathname` is already the one page that state is allowed to see.
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

  const target = targetFor(account);
  return pathname === target ? null : target;
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

  return routeFor(account, "/") ?? "/home";
}

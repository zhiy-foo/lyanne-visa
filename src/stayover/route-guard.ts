import "server-only";
import { redirect } from "next/navigation";
import { getAccountOutcome } from "./account";
import { routeFor, routeForAccountUnavailable, type MyAccount } from "./routing";

/**
 * Page-level defense in depth for Decision 5's routing (Law 4: the routing
 * must hold even if src/proxy.ts is ever bypassed or misconfigured — the
 * same "belt and braces" reasoning as the database functions' own
 * redundant grants). Every protected page calls this with its own path
 * first; it redirects away if that page isn't the one this account's state
 * is allowed to see, and otherwise returns the account.
 *
 * If `my_account()` itself failed (see AccountOutcome in account.ts), this
 * redirects to /sign-in?error=account-unavailable rather than treating the
 * signed-in caller as signed out.
 */
export async function requireAccountForPath(pathname: string): Promise<MyAccount> {
  const outcome = await getAccountOutcome();
  if (outcome.kind === "error") {
    redirect(routeForAccountUnavailable(pathname) ?? "/sign-in?error=account-unavailable");
  }
  const account = outcome.kind === "account" ? outcome.account : null;
  const target = routeFor(account, pathname);
  if (target) {
    redirect(target);
  }
  // routeFor only returns null for a non-public pathname when `account` is
  // non-null (a signed-out caller is redirected for every path except the
  // public ones, none of which call this helper) — so this is reachable.
  return account as MyAccount;
}

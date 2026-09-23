import "server-only";
import { redirect } from "next/navigation";
import { getAccount } from "./account";
import { routeFor, type MyAccount } from "./routing";

/**
 * Page-level defense in depth for Decision 5's routing (Law 4: the routing
 * must hold even if src/proxy.ts is ever bypassed or misconfigured — the
 * same "belt and braces" reasoning as the database functions' own
 * redundant grants). Every protected page calls this with its own path
 * first; it redirects away if that page isn't the one this account's state
 * is allowed to see, and otherwise returns the account.
 */
export async function requireAccountForPath(pathname: string): Promise<MyAccount> {
  const account = await getAccount();
  const target = routeFor(account, pathname);
  if (target) {
    redirect(target);
  }
  // routeFor only returns null for a non-public pathname when `account` is
  // non-null (a signed-out caller is redirected for every path except the
  // public ones, none of which call this helper) — so this is reachable.
  return account as MyAccount;
}

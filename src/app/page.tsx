import { redirect } from "next/navigation";
import { getAccountOutcome } from "@/stayover/account";
import { routeFor, routeForAccountUnavailable } from "@/stayover/routing";

// src/proxy.ts already routes every request per design.md Decision 5; this
// is the page-level defense in depth (see src/stayover/route-guard.ts) for
// the one path that never has a matching screen of its own.
export default async function RootPage() {
  const outcome = await getAccountOutcome();
  if (outcome.kind === "error") {
    redirect(routeForAccountUnavailable("/") ?? "/sign-in?error=account-unavailable");
  }
  const account = outcome.kind === "account" ? outcome.account : null;
  redirect(routeFor(account, "/") ?? "/sign-in");
}

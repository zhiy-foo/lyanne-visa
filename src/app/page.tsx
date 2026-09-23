import { redirect } from "next/navigation";
import { getAccount } from "@/stayover/account";
import { routeFor } from "@/stayover/routing";

// src/proxy.ts already routes every request per design.md Decision 5; this
// is the page-level defense in depth (see src/stayover/route-guard.ts) for
// the one path that never has a matching screen of its own.
export default async function RootPage() {
  const account = await getAccount();
  redirect(routeFor(account, "/") ?? "/sign-in");
}

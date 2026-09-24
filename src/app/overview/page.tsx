import { AppShell } from "@/ui/AppShell";
import { requireAccountForPath } from "@/stayover/route-guard";
import { signOut } from "@/stayover/actions/auth";
import { loadOverview } from "@/stayover/data/stays";
import { navFor } from "@/stayover/nav";
import { OverviewClient } from "./OverviewClient";

/** spec "Overview shows what needs the viewer's attention" — the landing
 * page every active member now routes to (src/stayover/routing.ts). */
export default async function OverviewPage() {
  const account = await requireAccountForPath("/overview");
  const role = account.role ?? "parent";
  const stays = await loadOverview();

  return (
    <AppShell user={{ name: account.name ?? "" }} nav={navFor(role, "/overview")} onSignOut={signOut}>
      <OverviewClient name={account.name ?? ""} stays={stays} />
    </AppShell>
  );
}

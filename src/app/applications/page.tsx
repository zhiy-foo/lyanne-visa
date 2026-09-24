import { AppShell } from "@/ui/AppShell";
import { requireAccountForPath } from "@/stayover/route-guard";
import { signOut } from "@/stayover/actions/auth";
import { loadApplications } from "@/stayover/data/stays";
import { navFor } from "@/stayover/nav";
import { ApplicationsClient } from "./ApplicationsClient";

/** spec "Applications list is grouped by what the viewer must do". */
export default async function ApplicationsPage() {
  const account = await requireAccountForPath("/applications");
  const role = account.role ?? "parent";
  const stays = await loadApplications();

  return (
    <AppShell user={{ name: account.name ?? "" }} nav={navFor(role, "/applications")} onSignOut={signOut}>
      <ApplicationsClient stays={stays} canCreate={role === "parent"} />
    </AppShell>
  );
}

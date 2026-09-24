import { AppShell } from "@/ui/AppShell";
import { AdminHomes } from "@/ui/screens/AdminHomes";
import { requireAccountForPath } from "@/stayover/route-guard";
import { signOut } from "@/stayover/actions/auth";
import { linkHost } from "@/stayover/actions/admin";
import { updateHome } from "@/stayover/actions/host";
import { loadAdminData } from "@/stayover/data/admin";
import { adminNav } from "../nav";

export default async function AdminHomesPage() {
  await requireAccountForPath("/admin/homes");

  const { accounts, homes } = await loadAdminData();
  const timeZones = Intl.supportedValuesOf("timeZone");
  const waitingCount = accounts.filter((account) => account.status === "waiting").length;

  return (
    <AppShell user={{ name: "Admin" }} nav={adminNav("homes", waitingCount)} onSignOut={signOut}>
      <AdminHomes
        homes={homes}
        accounts={accounts}
        timeZones={timeZones}
        onUpdateHome={updateHome}
        onLinkHost={linkHost}
      />
    </AppShell>
  );
}

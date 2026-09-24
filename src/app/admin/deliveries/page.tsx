import { AppShell } from "@/ui/AppShell";
import { AdminDeliveries } from "@/ui/screens/AdminDeliveries";
import { requireAccountForPath } from "@/stayover/route-guard";
import { signOut } from "@/stayover/actions/auth";
import { loadAdminFailedDispatches } from "@/delivery/data/admin";
import { adminNav } from "../nav";

export default async function AdminDeliveriesPage() {
  await requireAccountForPath("/admin/deliveries");

  const dispatches = await loadAdminFailedDispatches();

  return (
    <AppShell user={{ name: "Admin" }} nav={adminNav("deliveries", 0, dispatches.length)} onSignOut={signOut}>
      <AdminDeliveries dispatches={dispatches} />
    </AppShell>
  );
}

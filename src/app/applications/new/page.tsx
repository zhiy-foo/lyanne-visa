import { redirect } from "next/navigation";
import { AppShell } from "@/ui/AppShell";
import { requireAccountForPath } from "@/stayover/route-guard";
import { signOut } from "@/stayover/actions/auth";
import { loadPlanStayOptions } from "@/stayover/data/stays";
import { navFor } from "@/stayover/nav";
import { PlanStayClient } from "./PlanStayClient";

/** spec "Parents open an application" — parents only; a host lands here via
 * a stale link or a typed URL and is sent to /applications instead (rule 3
 * — "a host cannot open an application" — enforced again, authoritatively,
 * by open_application itself; this is the friendly early refusal). */
export default async function NewApplicationPage() {
  const account = await requireAccountForPath("/applications/new");
  if (account.role !== "parent") {
    redirect("/applications");
  }

  const options = await loadPlanStayOptions();

  return (
    <AppShell user={{ name: account.name ?? "" }} nav={navFor("parent", "/applications/new")} onSignOut={signOut}>
      <PlanStayClient {...options} />
    </AppShell>
  );
}

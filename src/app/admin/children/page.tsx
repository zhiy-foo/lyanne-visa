import { AppShell } from "@/ui/AppShell";
import { AdminChildren } from "@/ui/screens/AdminChildren";
import { requireAccountForPath } from "@/stayover/route-guard";
import { signOut } from "@/stayover/actions/auth";
import { linkParent } from "@/stayover/actions/admin";
import { renameChild } from "@/stayover/actions/parent";
import { loadAdminData } from "@/stayover/data/admin";
import { adminNav } from "../nav";

export default async function AdminChildrenPage() {
  await requireAccountForPath("/admin/children");

  const { accounts, children } = await loadAdminData();
  const waitingCount = accounts.filter((account) => account.status === "waiting").length;

  // AdminChildrenProps' data prop is (necessarily) named "children"; spread
  // it in rather than writing it as a literal JSX attribute so the JSX
  // linter doesn't mistake it for React's `children` special prop.
  const adminChildrenProps = {
    children,
    accounts,
    onRenameChild: renameChild,
    onLinkParent: linkParent,
  };

  return (
    <AppShell user={{ name: "Admin" }} nav={adminNav("children", waitingCount)} onSignOut={signOut}>
      <AdminChildren {...adminChildrenProps} />
    </AppShell>
  );
}

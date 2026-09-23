import { AppShell } from "@/ui/AppShell";
import { Admin } from "@/ui/screens/Admin";
import { requireAccountForPath } from "@/stayover/route-guard";
import { signOut } from "@/stayover/actions/auth";
import {
  approveMember,
  declineMember,
  deactivateMember,
  linkHost,
  linkParent,
  reactivateMember,
  setJoinCode,
  setMemberRole,
} from "@/stayover/actions/admin";
import { renameChild } from "@/stayover/actions/parent";
import { updateHome } from "@/stayover/actions/host";
import { loadAdminData } from "@/stayover/data/admin";

export default async function AdminPage() {
  await requireAccountForPath("/admin");

  const { accounts, children, homes, joinCodeSet } = await loadAdminData();
  const timeZones = Intl.supportedValuesOf("timeZone");

  // AdminProps' data prop is (necessarily) named "children"; spread it in
  // rather than writing it as a literal JSX attribute so the JSX linter
  // doesn't mistake it for React's `children` special prop.
  const adminProps = {
    accounts,
    joinCodeSet,
    children,
    homes,
    timeZones,
    onApprove: approveMember,
    onDecline: declineMember,
    onSetJoinCode: setJoinCode,
    onDeactivate: deactivateMember,
    onReactivate: reactivateMember,
    onSetRole: setMemberRole,
    onRenameChild: renameChild,
    onUpdateHome: updateHome,
    onLinkParent: linkParent,
    onLinkHost: linkHost,
  };

  return (
    <AppShell
      user={{ name: "Admin" }}
      nav={[{ label: "Accounts", href: "/admin", current: true }]}
      onSignOut={signOut}
    >
      <Admin {...adminProps} />
    </AppShell>
  );
}

import { AppShell } from "@/ui/AppShell";
import { AdminAccounts } from "@/ui/screens/AdminAccounts";
import { requireAccountForPath } from "@/stayover/route-guard";
import { signOut } from "@/stayover/actions/auth";
import {
  approveMember,
  declineMember,
  deactivateMember,
  reactivateMember,
  setJoinCode,
  setMemberRole,
  deleteMember,
} from "@/stayover/actions/admin";
import { loadAdminData } from "@/stayover/data/admin";
import { adminNav } from "../nav";

export default async function AdminAccountsPage() {
  await requireAccountForPath("/admin/accounts");

  const { accounts, joinCodeSet } = await loadAdminData();
  const waitingCount = accounts.filter((account) => account.status === "waiting").length;

  return (
    <AppShell user={{ name: "Admin" }} nav={adminNav("accounts", waitingCount)} onSignOut={signOut}>
      <AdminAccounts
        accounts={accounts}
        joinCodeSet={joinCodeSet}
        onApprove={approveMember}
        onDecline={declineMember}
        onSetJoinCode={setJoinCode}
        onDeactivate={deactivateMember}
        onReactivate={reactivateMember}
        onSetRole={setMemberRole}
        onDelete={deleteMember}
      />
    </AppShell>
  );
}

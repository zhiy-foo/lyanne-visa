import { Deactivated } from "@/ui/screens/Deactivated";
import { signOut } from "@/stayover/actions/auth";
import { requireAccountForPath } from "@/stayover/route-guard";

export default async function DeactivatedPage() {
  const account = await requireAccountForPath("/deactivated");

  return <Deactivated email={account.email} onSignOut={signOut} />;
}

import { Waiting } from "@/ui/screens/Waiting";
import { signOut } from "@/stayover/actions/auth";
import { requireAccountForPath } from "@/stayover/route-guard";

export default async function WaitingPage() {
  const account = await requireAccountForPath("/waiting");

  return <Waiting name={account.name ?? ""} email={account.email} onSignOut={signOut} />;
}

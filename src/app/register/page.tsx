import { Register } from "@/ui/screens/Register";
import { register } from "@/stayover/actions/register";
import { signOut } from "@/stayover/actions/auth";
import { requireAccountForPath } from "@/stayover/route-guard";

export default async function RegisterPage() {
  const account = await requireAccountForPath("/register");

  return (
    <Register
      email={account.email}
      codeAttemptsLeft={account.codeAttemptsLeft}
      onRegister={register}
      onSignOut={signOut}
    />
  );
}

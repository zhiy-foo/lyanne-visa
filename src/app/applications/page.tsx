import { AppShell } from "@/ui/AppShell";
import { requireAccountForPath } from "@/stayover/route-guard";
import { signOut } from "@/stayover/actions/auth";
import { loadApplications, loadContactsTipDismissed } from "@/stayover/data/stays";
import { navFor } from "@/stayover/nav";
import { smtpConfigured, fromAddress } from "@/delivery/mailer-smtp";
import { ApplicationsClient } from "./ApplicationsClient";

/** spec "Applications list is grouped by what the viewer must do". */
export default async function ApplicationsPage() {
  const account = await requireAccountForPath("/applications");
  const role = account.role ?? "parent";
  const stays = await loadApplications();
  // task 5.2's contacts tip only makes sense once the app actually sends
  // from a real address (SMTP configured) — never guess/fall back to a
  // placeholder here, unlike renderDispatch's organizer (which always needs
  // *some* value for the .ics ORGANIZER field even in console-mailer dev
  // mode).
  const appEmail = smtpConfigured() ? fromAddress() : undefined;
  // Only worth the read when the tip could show at all.
  const contactsTipDismissed = appEmail ? await loadContactsTipDismissed() : true;

  return (
    <AppShell user={{ name: account.name ?? "" }} nav={navFor(role, "/applications")} onSignOut={signOut}>
      <ApplicationsClient
        stays={stays}
        canCreate={role === "parent"}
        appEmail={appEmail}
        contactsTipDismissed={contactsTipDismissed}
      />
    </AppShell>
  );
}

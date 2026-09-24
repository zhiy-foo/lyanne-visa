import { AppShell } from "@/ui/AppShell";
import { ParentHome } from "@/ui/screens/ParentHome";
import { HostHome } from "@/ui/screens/HostHome";
import { requireAccountForPath } from "@/stayover/route-guard";
import { signOut } from "@/stayover/actions/auth";
import { addChild, addCoParent, removeParent, renameChild } from "@/stayover/actions/parent";
import { addCoHost, addHome, removeHost, updateHome } from "@/stayover/actions/host";
import { setPlaceCapacity } from "@/stayover/actions/stays";
import { loadHostHome, loadParentHome } from "@/stayover/data/home";
import { navFor } from "@/stayover/nav";

export default async function HomePage() {
  const account = await requireAccountForPath("/home");
  const me = { name: account.name ?? "", email: account.email };

  if (account.role === "parent") {
    const { children, homes } = await loadParentHome();
    // ParentHomeProps' data prop is (necessarily) named "children"; spread
    // it in rather than writing it as a literal JSX attribute so the JSX
    // linter doesn't mistake it for React's `children` special prop.
    const parentHomeProps = {
      me,
      children,
      homes,
      onAddChild: addChild,
      onRenameChild: renameChild,
      onAddCoParent: addCoParent,
      onRemoveParent: removeParent,
    };
    return (
      <AppShell user={{ name: me.name }} nav={navFor("parent", "/home")} onSignOut={signOut}>
        <ParentHome {...parentHomeProps} />
      </AppShell>
    );
  }

  const { homes } = await loadHostHome();
  const timeZones = Intl.supportedValuesOf("timeZone");
  return (
    <AppShell user={{ name: me.name }} nav={navFor("host", "/home")} onSignOut={signOut}>
      <HostHome
        me={me}
        homes={homes}
        timeZones={timeZones}
        onAddHome={addHome}
        onUpdateHome={updateHome}
        onAddCoHost={addCoHost}
        onRemoveHost={removeHost}
        onSetCapacity={setPlaceCapacity}
      />
    </AppShell>
  );
}

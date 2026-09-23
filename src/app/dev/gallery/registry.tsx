// Dev-only registry wiring src/ui screens to fixture data for the gallery.
// This file lives under src/app (not src/ui) so it is free to reach into
// app-level concerns; src/ui itself stays router- and fetch-agnostic.
import type { ReactNode } from "react";
import type { NavItem } from "@/ui/AppShell";
import { SignIn } from "@/ui/screens/SignIn";
import { Register } from "@/ui/screens/Register";
import { Waiting } from "@/ui/screens/Waiting";
import { Deactivated } from "@/ui/screens/Deactivated";
import { ParentHome } from "@/ui/screens/ParentHome";
import { HostHome } from "@/ui/screens/HostHome";
import { Admin } from "@/ui/screens/Admin";
import {
  signInFixtures,
  registerFixtures,
  waitingFixtures,
  deactivatedFixtures,
  parentHomeFixtures,
  hostHomeFixtures,
  adminFixtures,
} from "@/ui/fixtures";

const parentNav: NavItem[] = [
  { label: "Overview", href: "#overview" },
  { label: "Applications", href: "#applications" },
  { label: "Plan a stay", href: "#plan" },
  { label: "My children", href: "#my-children", current: true },
];

const hostNav: NavItem[] = [
  { label: "Overview", href: "#overview" },
  { label: "Applications", href: "#applications" },
  { label: "My home", href: "#my-home", current: true },
];

const adminNav: NavItem[] = [
  { label: "Accounts", href: "#accounts", current: true },
  { label: "Join code", href: "#join-code" },
];

export type ScreenEntry = {
  key: string;
  label: string;
  states: string[];
};

export const screenList: ScreenEntry[] = [
  { key: "sign-in", label: "Sign in", states: Object.keys(signInFixtures) },
  { key: "register", label: "Register", states: Object.keys(registerFixtures) },
  { key: "waiting", label: "Waiting", states: Object.keys(waitingFixtures) },
  { key: "deactivated", label: "Deactivated", states: Object.keys(deactivatedFixtures) },
  { key: "parent-home", label: "ParentHome", states: Object.keys(parentHomeFixtures) },
  { key: "host-home", label: "HostHome", states: Object.keys(hostHomeFixtures) },
  { key: "admin", label: "Admin", states: Object.keys(adminFixtures) },
];

export type RenderedScreen = {
  label: string;
  user?: { name: string };
  nav: NavItem[];
  node: ReactNode;
};

export function renderScreen(key: string, state: string | undefined): RenderedScreen | null {
  switch (key) {
    case "sign-in": {
      const props = signInFixtures[state ?? "default"] ?? signInFixtures.default;
      return { label: "Sign in", nav: [], node: <SignIn {...props} /> };
    }
    case "register": {
      const props = registerFixtures[state ?? "default"] ?? registerFixtures.default;
      return { label: "Register", nav: [], node: <Register {...props} /> };
    }
    case "waiting": {
      const props = waitingFixtures[state ?? "default"] ?? waitingFixtures.default;
      return { label: "Waiting", nav: [], node: <Waiting {...props} /> };
    }
    case "deactivated": {
      const props = deactivatedFixtures[state ?? "default"] ?? deactivatedFixtures.default;
      return { label: "Deactivated", nav: [], node: <Deactivated {...props} /> };
    }
    case "parent-home": {
      const props = parentHomeFixtures[state ?? "default"] ?? parentHomeFixtures.default;
      return {
        label: "ParentHome",
        user: { name: props.me.name },
        nav: parentNav,
        node: <ParentHome {...props} />,
      };
    }
    case "host-home": {
      const props = hostHomeFixtures[state ?? "default"] ?? hostHomeFixtures.default;
      return {
        label: "HostHome",
        user: { name: props.me.name },
        nav: hostNav,
        node: <HostHome {...props} />,
      };
    }
    case "admin": {
      const props = adminFixtures[state ?? "default"] ?? adminFixtures.default;
      return {
        label: "Admin",
        user: { name: "Admin" },
        nav: adminNav,
        node: <Admin {...props} />,
      };
    }
    default:
      return null;
  }
}

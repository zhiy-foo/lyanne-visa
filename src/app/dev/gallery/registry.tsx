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
import { AdminAccounts } from "@/ui/screens/AdminAccounts";
import { AdminChildren } from "@/ui/screens/AdminChildren";
import { AdminHomes } from "@/ui/screens/AdminHomes";
import { AdminDeliveries } from "@/ui/screens/AdminDeliveries";
import { Overview } from "@/ui/screens/Overview";
import { Applications } from "@/ui/screens/Applications";
import { PlanStay } from "@/ui/screens/PlanStay";
import { ApplicationDetail } from "@/ui/screens/ApplicationDetail";
import {
  signInFixtures,
  registerFixtures,
  waitingFixtures,
  deactivatedFixtures,
  parentHomeFixtures,
  hostHomeFixtures,
  adminAccountsFixtures,
  adminChildrenFixtures,
  adminHomesFixtures,
  adminDeliveriesFixtures,
  overviewFixtures,
  applicationsFixtures,
  planStayFixtures,
  applicationDetailFixtures,
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

type AdminSection = "accounts" | "children" | "homes" | "deliveries";

function adminNav(current: AdminSection, waitingCount: number, failedDeliveryCount = 0): NavItem[] {
  return [
    {
      label: "Accounts",
      href: "#accounts",
      current: current === "accounts",
      badge: waitingCount > 0 ? waitingCount : undefined,
    },
    { label: "Children", href: "#children", current: current === "children" },
    { label: "Homes", href: "#homes", current: current === "homes" },
    {
      label: "Deliveries",
      href: "#deliveries",
      current: current === "deliveries",
      badge: failedDeliveryCount > 0 ? failedDeliveryCount : undefined,
    },
  ];
}

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
  { key: "admin-accounts", label: "AdminAccounts", states: Object.keys(adminAccountsFixtures) },
  { key: "admin-children", label: "AdminChildren", states: Object.keys(adminChildrenFixtures) },
  { key: "admin-homes", label: "AdminHomes", states: Object.keys(adminHomesFixtures) },
  { key: "admin-deliveries", label: "AdminDeliveries", states: Object.keys(adminDeliveriesFixtures) },
  { key: "overview", label: "Overview", states: Object.keys(overviewFixtures) },
  { key: "applications", label: "Applications", states: Object.keys(applicationsFixtures) },
  { key: "plan-stay", label: "PlanStay", states: Object.keys(planStayFixtures) },
  { key: "application-detail", label: "ApplicationDetail", states: Object.keys(applicationDetailFixtures) },
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
    case "admin-accounts": {
      const props = adminAccountsFixtures[state ?? "default"] ?? adminAccountsFixtures.default;
      const waitingCount = props.accounts.filter((account) => account.status === "waiting").length;
      return {
        label: "AdminAccounts",
        user: { name: "Admin" },
        nav: adminNav("accounts", waitingCount),
        node: <AdminAccounts {...props} />,
      };
    }
    case "admin-children": {
      const props = adminChildrenFixtures[state ?? "default"] ?? adminChildrenFixtures.default;
      const waitingCount = props.accounts.filter((account) => account.status === "waiting").length;
      return {
        label: "AdminChildren",
        user: { name: "Admin" },
        nav: adminNav("children", waitingCount),
        node: <AdminChildren {...props} />,
      };
    }
    case "admin-homes": {
      const props = adminHomesFixtures[state ?? "default"] ?? adminHomesFixtures.default;
      const waitingCount = props.accounts.filter((account) => account.status === "waiting").length;
      return {
        label: "AdminHomes",
        user: { name: "Admin" },
        nav: adminNav("homes", waitingCount),
        node: <AdminHomes {...props} />,
      };
    }
    case "admin-deliveries": {
      const props = adminDeliveriesFixtures[state ?? "empty"] ?? adminDeliveriesFixtures.empty;
      return {
        label: "AdminDeliveries",
        user: { name: "Admin" },
        nav: adminNav("deliveries", 0, props.dispatches.length),
        node: <AdminDeliveries {...props} />,
      };
    }
    case "overview": {
      const props = overviewFixtures[state ?? "parent-awaiting-you"] ?? overviewFixtures["parent-awaiting-you"];
      const viewerSide = props.stays[0]?.viewerSide ?? "parent";
      const nav = viewerSide === "host" ? hostNav : parentNav;
      return {
        label: "Overview",
        user: { name: props.name },
        nav: nav.map((item) => ({ ...item, current: item.label === "Overview" })),
        node: <Overview {...props} />,
      };
    }
    case "applications": {
      const props = applicationsFixtures[state ?? "parent-mixed"] ?? applicationsFixtures["parent-mixed"];
      const nav = props.canCreate ? parentNav : hostNav;
      return {
        label: "Applications",
        user: { name: props.canCreate ? "Mum" : "Grandma" },
        nav: nav.map((item) => ({ ...item, current: item.label === "Applications" })),
        node: <Applications {...props} />,
      };
    }
    case "plan-stay": {
      const props = planStayFixtures[state ?? "default"] ?? planStayFixtures.default;
      return {
        label: "PlanStay",
        user: { name: "Mum" },
        nav: parentNav.map((item) => ({ ...item, current: item.label === "Plan a stay" })),
        node: <PlanStay {...props} />,
      };
    }
    case "application-detail": {
      const props =
        applicationDetailFixtures[state ?? "parent-awaiting-you"] ??
        applicationDetailFixtures["parent-awaiting-you"];
      const nav = props.viewerSide === "host" ? hostNav : parentNav;
      return {
        label: "ApplicationDetail",
        user: { name: props.viewerSide === "host" ? "Grandma" : "Mum" },
        nav: nav.map((item) => ({ ...item, current: item.label === "Applications" })),
        node: <ApplicationDetail {...props} />,
      };
    }
    default:
      return null;
  }
}

// Shared nav builder for the three admin pages (accounts/children/homes).
// Lives under src/app (not src/ui) because it's wiring for the router, not
// a presentational component.
import type { NavItem } from "@/ui/AppShell";

export type AdminSection = "accounts" | "children" | "homes" | "deliveries";

export function adminNav(current: AdminSection, waitingCount: number, failedDeliveryCount = 0): NavItem[] {
  return [
    {
      label: "Accounts",
      href: "/admin/accounts",
      current: current === "accounts",
      badge: waitingCount > 0 ? waitingCount : undefined,
    },
    { label: "Children", href: "/admin/children", current: current === "children" },
    { label: "Homes", href: "/admin/homes", current: current === "homes" },
    {
      label: "Deliveries",
      href: "/admin/deliveries",
      current: current === "deliveries",
      badge: failedDeliveryCount > 0 ? failedDeliveryCount : undefined,
    },
  ];
}

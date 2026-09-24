import type { NavItem } from "@/ui/AppShell";
import type { Side } from "@/ui/types";

// Task 6.5's nav: "Overview · Applications · Plan a stay · My children"
// (parents) / "Overview · Applications · My home" (hosts). One builder
// shared by every stage-2 page so the item list/order can't drift between
// routes, mirroring src/app/dev/gallery/registry.tsx's parentNav/hostNav
// (kept separate from that file — this one uses real hrefs, the gallery's
// use '#' anchors).
export function navFor(role: Side, current: string): NavItem[] {
  const items: NavItem[] =
    role === "parent"
      ? [
          { label: "Overview", href: "/overview" },
          { label: "Applications", href: "/applications" },
          { label: "Plan a stay", href: "/applications/new" },
          { label: "My children", href: "/home" },
        ]
      : [
          { label: "Overview", href: "/overview" },
          { label: "Applications", href: "/applications" },
          { label: "My home", href: "/home" },
        ];

  return items.map((item) => ({ ...item, current: item.href === current }));
}

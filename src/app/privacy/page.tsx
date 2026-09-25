import type { Metadata } from "next";
import { Privacy } from "@/ui/screens/Privacy";

// Public, static page — reachable signed out and in every signed-in account
// state (src/stayover/routing.ts's ALWAYS_PUBLIC_PATHS, checked first in
// routeFor, so neither src/proxy.ts nor requireAccountForPath ever redirects
// it away). Needed for Google OAuth branding verification (setup.md §4:
// privacy policy = <site>/privacy). No data fetching, so this renders
// statically at build time.
export const metadata: Metadata = {
  title: "Privacy policy · Lyanne Visa",
};

export default function PrivacyPage() {
  return <Privacy />;
}

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  classifyMyAccountRpc,
  routeFor,
  routeForAccountUnavailable,
  type MyAccount,
  type MyAccountRow,
} from "@/stayover/routing";
import { supabasePublishableKey, supabaseUrl } from "@/stayover/supabase/env";

/**
 * Next.js's "run code before a route renders" file (renamed from
 * middleware.js to proxy.js in v16 — see
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
 * Refreshes the Supabase session cookie on every page load (@supabase/ssr's
 * documented pattern — expired refresh tokens are single-use, so this must
 * run before the page renders, not just when a Server Component happens to
 * call auth.getUser()) and applies design.md Decision 5's routing so a deep
 * link cannot skip it (task 3.1). Individual protected pages repeat the
 * check for defense in depth (src/stayover/route-guard.ts) in case this file
 * is ever bypassed or its matcher misconfigured.
 *
 * This file cannot use next/headers' `cookies()` (that only works in Server
 * Components/Actions/Route Handlers) — it builds its own Supabase client
 * from the NextRequest/NextResponse cookie APIs instead, per @supabase/ssr's
 * middleware example.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The dev-only screen gallery isn't part of the routed app; its own route
  // 404s in production builds (src/app/dev/gallery/[screen]/page.tsx), so
  // there is nothing to enforce here either way.
  if (pathname === "/dev" || pathname.startsWith("/dev/")) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let account: MyAccount | null = null;
  let accountUnavailable = false;
  if (user) {
    const { data, error } = await supabase.rpc("my_account");
    const outcome = classifyMyAccountRpc(data as MyAccountRow[] | null, error);
    if (outcome.kind === "error") {
      // A signed-in user whose account couldn't be loaded (e.g. the hosted
      // database hasn't had its migrations pushed yet) must not be treated
      // as signed out — that would silently bounce them to /sign-in with no
      // explanation. Log server-side and surface it via the error param
      // instead (routeForAccountUnavailable).
      console.error("proxy: my_account() RPC failed", error);
      accountUnavailable = true;
    } else if (outcome.kind === "account") {
      account = outcome.account;
    }
  }

  const target = accountUnavailable ? routeForAccountUnavailable(pathname) : routeFor(account, pathname);
  if (target) {
    const [path, search] = target.split("?");
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = path;
    redirectUrl.search = search ? `?${search}` : "";

    const redirectResponse = NextResponse.redirect(redirectUrl);
    supabaseResponse.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  return supabaseResponse;
}

export const config = {
  // Skip static assets and image optimization; everything else (including
  // "/") goes through the routing above.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

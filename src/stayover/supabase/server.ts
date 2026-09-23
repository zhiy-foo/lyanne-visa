import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublishableKey, supabaseUrl } from "./env";

/**
 * A Supabase client for Server Components, Server Actions and Route
 * Handlers, per @supabase/ssr's documented Next.js App Router pattern
 * (design.md Decision 1). Reading cookies always works; writing them only
 * works from a Server Action or Route Handler — the try/catch below is
 * deliberate, not error-hiding: a Server Component calling this during
 * render legitimately cannot set cookies, and the session is refreshed on
 * the next request by src/proxy.ts instead.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called during a Server Component render; no-op (see above).
        }
      },
    },
  });
}

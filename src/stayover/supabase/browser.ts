"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "./env";

/**
 * A Supabase client for the browser — used only for Google sign-in
 * (src/app/sign-in/SignInClient.tsx), which needs supabase-js to redirect
 * the browser to Google's consent screen itself. Everything else goes
 * through Server Actions with the server client (Decision 1, Law 4: the
 * Browser reaches Db only through server actions or, here, through
 * Supabase Auth's own OAuth redirect — never a direct table/RPC call).
 */
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabasePublishableKey());
}

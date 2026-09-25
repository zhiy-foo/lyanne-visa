import { NextResponse } from "next/server";
import { safeNextPath } from "@/app/sign-in/google-sign-in-support";
import { mapAuthQueryError } from "@/stayover/auth-errors";
import { classifyMyAccountRpc, resolveDestination, type MyAccountRow } from "@/stayover/routing";
import { createClient } from "@/stayover/supabase/server";

/**
 * Exchanges the Supabase Auth code for a session (email link or Google —
 * both use the PKCE flow, so both land here with `?code=...` on success),
 * then routes per design.md Decision 5. Provider/link errors arrive as
 * query params here (`?error=access_denied&error_code=otp_expired`); the
 * hash-fragment variant the browser never sends to the server is handled by
 * src/app/sign-in/SignInClient.tsx instead (see src/stayover/auth-errors.ts).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const providerError = url.searchParams.get("error");
  const providerErrorCode = url.searchParams.get("error_code");

  const mappedError = mapAuthQueryError(providerError, providerErrorCode);
  if (mappedError) {
    return NextResponse.redirect(new URL(`/sign-in?error=${mappedError}`, origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/sign-in?error=generic", origin));
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return NextResponse.redirect(new URL("/sign-in?error=link-expired", origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/sign-in?error=generic", origin));
  }

  const { data, error: accountError } = await supabase.rpc("my_account");
  const outcome = classifyMyAccountRpc(data as MyAccountRow[] | null, accountError);
  if (outcome.kind === "error") {
    // The person really did just sign in — do not send them to /sign-in
    // looking like it failed silently; surface why instead.
    console.error("auth callback: my_account() RPC failed", accountError);
    return NextResponse.redirect(new URL("/sign-in?error=account-unavailable", origin));
  }
  const account = outcome.kind === "account" ? outcome.account : null;

  // resolveDestination can echo the caller-supplied `next` path back
  // unchanged (see src/stayover/routing.ts); routing it through
  // safeNextPath guarantees the final redirect target is always a
  // same-origin relative path, no open redirects.
  const destination = safeNextPath(resolveDestination(account, next), origin);
  return NextResponse.redirect(new URL(destination, origin));
}

import { NextResponse } from "next/server";
import { mapAuthQueryError } from "@/stayover/auth-errors";
import { mapMyAccountRow, resolveDestination, type MyAccountRow } from "@/stayover/routing";
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

  const { data } = await supabase.rpc("my_account");
  const row = (data as MyAccountRow[] | null)?.[0];
  const account = row ? mapMyAccountRow(row) : null;

  const destination = resolveDestination(account, next);
  return NextResponse.redirect(new URL(destination, origin));
}

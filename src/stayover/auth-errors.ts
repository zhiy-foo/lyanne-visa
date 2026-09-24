// Maps Supabase Auth's own error reporting to the sign-in page's error
// variant (SignInProps["error"] in src/ui/types.ts). Supabase reports
// sign-in failures two different ways depending on the flow: as query
// params on the redirect (the PKCE flow this app uses for both the email
// link and Google), or — defensively, since project auth settings can
// change this — as a URL hash fragment the server never sees, which only a
// client component can read.

export type SignInError = "link-expired" | "google-cancelled" | "generic";

/** Query-string variant: `?error=access_denied&error_code=otp_expired&...`.
 * Used by src/app/auth/callback/route.ts. */
export function mapAuthQueryError(error: string | null, errorCode: string | null): SignInError | null {
  if (!error) return null;
  if (errorCode === "otp_expired") return "link-expired";
  if (error === "access_denied") return "google-cancelled";
  return "generic";
}

/** Hash variant: `#error=access_denied&error_code=otp_expired&...`, read
 * client-side from `location.hash` (leading "#" optional). Used by
 * src/app/sign-in/SignInClient.tsx as a fallback the query-param path can't
 * cover, because a hash fragment never reaches the server. */
export function mapAuthHashError(hash: string): SignInError | null {
  const cleaned = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!cleaned) return null;
  const params = new URLSearchParams(cleaned);
  return mapAuthQueryError(params.get("error"), params.get("error_code"));
}

const RATE_LIMIT_CODES = new Set(["over_email_send_rate_limit", "over_request_rate_limit"]);

const RATE_LIMIT_MESSAGE =
  "Please wait a minute before asking for another link — check your inbox, the last one may already be there.";

const GENERIC_SEND_LINK_MESSAGE = "We couldn't send that link. Please try again.";

/** Maps a `signInWithOtp` failure (src/stayover/actions/auth.ts
 * `requestSignInLink`) to the message shown to the person. Supabase rejects
 * requests for a second link within its cooldown window with an HTTP 429
 * and a `code` of `over_email_send_rate_limit` or `over_request_rate_limit`
 * (see @supabase/auth-js's AuthApiError, which carries both `status` and
 * `code`); that case gets a specific message so people know their first
 * link probably already arrived. Everything else keeps the generic
 * message — the raw error should still be logged server-side by the
 * caller. */
export function mapRequestSignInLinkError(status: number | undefined, code: string | undefined): string {
  if (status === 429 || (code !== undefined && RATE_LIMIT_CODES.has(code))) {
    return RATE_LIMIT_MESSAGE;
  }
  return GENERIC_SEND_LINK_MESSAGE;
}

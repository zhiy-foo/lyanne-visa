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

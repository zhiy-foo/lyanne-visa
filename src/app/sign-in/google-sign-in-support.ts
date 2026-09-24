// Pure helpers for src/app/sign-in/GoogleSignIn.tsx — kept dependency-free
// (only Web Crypto, which is a global in both the browser and Node) so they
// are unit-testable without a browser or jsdom environment.

/**
 * A random raw nonce for Google Identity Services' `initialize` call. The
 * SHA-256 hash of this value (see `sha256Hex`) is what's handed to Google;
 * the ID token Google returns carries that hash, and
 * `supabase.auth.signInWithIdToken` is given the raw value back so it can
 * reverse the check (nonce checks stay on in Supabase's Google provider —
 * docs/stayover/general/setup.md §4).
 */
export function generateRawNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 hex digest of `value`. */
export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Lifecycle of the `https://accounts.google.com/gsi/client` script load,
 * tracked by GoogleSignIn.tsx and fed to `decideGoogleSignInMode`.
 * "pending": still waiting to hear back (script not yet loaded, timeout not
 * yet elapsed).
 */
export type GoogleScriptStatus = "pending" | "loaded" | "error" | "timeout";

export type GoogleSignInMode = "gis" | "fallback" | "pending";

/**
 * Whether to show the Google Identity Services button, the redirect-flow
 * fallback, or wait a little longer — a small pure function so the decision
 * is unit-testable without mounting the component. No `NEXT_PUBLIC_GOOGLE_
 * CLIENT_ID` configured, a script load error, or the ~4s load timeout all
 * fall back to the existing Supabase-redirect flow; a successful load uses
 * GIS.
 */
export function decideGoogleSignInMode(
  clientId: string | undefined,
  status: GoogleScriptStatus,
): GoogleSignInMode {
  if (!clientId) return "fallback";
  if (status === "loaded") return "gis";
  if (status === "error" || status === "timeout") return "fallback";
  return "pending";
}

/**
 * Where to send the browser after a successful Google Identity Services
 * sign-in: `next` if — and only if — it is a safe in-app path, otherwise
 * "/". Unlike `resolveDestination` in src/stayover/routing.ts, this never
 * runs the result through `routeFor` — there is no account available
 * client-side yet — so a full page navigation is used
 * (`window.location.assign`) and src/proxy.ts does the actual routing on
 * that next request.
 *
 * `next` is resolved against `origin` with `new URL` (rather than a plain
 * `startsWith("/")` check) because browsers normalise backslashes to
 * forward slashes and strip embedded tab/newline characters from URLs
 * before navigation: a naive check would let `/\evil.com` or
 * `"/\t/evil.com"` through as "safe" even though the browser turns them
 * into `//evil.com` — a same-origin-looking string that is actually an
 * off-site, protocol-relative redirect. Parsing with `new URL` first
 * applies that same normalisation, so the origin check after it sees what
 * the browser will actually navigate to. The raw input must also still
 * start with "/" — `new URL` alone would happily resolve a bare
 * `evil.com` against `origin` too.
 */
export function safeNextPath(next: string | null | undefined, origin: string): string {
  if (!next || !next.startsWith("/")) return "/";
  try {
    const url = new URL(next, origin);
    if (url.origin !== origin) return "/";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/";
  }
}

/**
 * Maps a Google Identity Services One Tap "dismissed" moment to the
 * sign-in screen's "google-cancelled" error, but only for an explicit
 * cancel (`cancel_called` — e.g. the person clicked outside the prompt,
 * which `cancel_on_tap_outside: true` turns into this reason). Other
 * dismissed/skipped reasons (auto_cancel, tap_outside without the option
 * set, issuing_failed, credential_returned) are not reported: One Tap not
 * showing, or being silently superseded, is not something the person did
 * wrong.
 */
export function mapPromptDismissal(dismissed: boolean, reason: string | undefined): "google-cancelled" | null {
  return dismissed && reason === "cancel_called" ? "google-cancelled" : null;
}

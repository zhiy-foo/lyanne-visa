"use client";

import { useEffect, useState } from "react";
import { SignIn } from "@/ui/screens/SignIn";
import type { ActionResult, SignInProps } from "@/ui/types";
import { requestSignInLink } from "@/stayover/actions/auth";
import { mapAuthHashError } from "@/stayover/auth-errors";
import { createClient } from "@/stayover/supabase/browser";
import { GoogleSignIn } from "./GoogleSignIn";

type Props = { error?: SignInProps["error"]; next?: string };

// Wires the presentational SignIn screen up to Supabase Auth. A client
// component (not the Server Component page) because Google sign-in needs
// supabase-js to redirect the browser itself (SignInProps.onGoogle is
// synchronous, not a Server Action — see src/stayover/supabase/browser.ts),
// and because reading `location.hash` for the defensive hash-error variant
// (src/stayover/auth-errors.ts) only works client-side.
export function SignInClient({ error, next }: Props) {
  const [hashError, setHashError] = useState<SignInProps["error"] | undefined>(undefined);
  const [googleError, setGoogleError] = useState<SignInProps["error"] | undefined>(undefined);

  useEffect(() => {
    if (error) return;
    if (typeof window === "undefined" || !window.location.hash) return;

    const mapped = mapAuthHashError(window.location.hash);
    if (mapped) {
      // `location.hash` is a browser-only API a server render can never see
      // (design.md: hash-fragment auth errors never reach the server at
      // all), so this is a genuine one-time sync with the outside world on
      // mount, not state that could be derived during render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHashError(mapped);
      // Drop the hash from the address bar now that it's been read.
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, [error]);

  async function onRequestLink(email: string): Promise<ActionResult> {
    return requestSignInLink(email, next);
  }

  function onGoogle() {
    const supabase = createClient();
    const search = next ? `?next=${encodeURIComponent(next)}` : "";
    void supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback${search}` },
    });
  }

  return (
    <SignIn
      error={error ?? hashError ?? googleError}
      onRequestLink={onRequestLink}
      onGoogle={onGoogle}
      googleSlot={<GoogleSignIn next={next} onRedirectFallback={onGoogle} onError={setGoogleError} />}
    />
  );
}

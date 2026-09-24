"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { Button } from "@/ui/Button";
import { createClient } from "@/stayover/supabase/browser";
import { googleClientId } from "@/stayover/supabase/env";
import {
  decideGoogleSignInMode,
  generateRawNonce,
  mapPromptDismissal,
  safeNextPath,
  sha256Hex,
  type GoogleScriptStatus,
} from "./google-sign-in-support";

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";
// How long to wait for the script to load before giving up and falling back
// to the redirect flow (decideGoogleSignInMode in google-sign-in-support.ts).
const LOAD_TIMEOUT_MS = 4000;

// Minimal shape of the `google.accounts.id` API this component calls
// (https://developers.google.com/identity/gsi/web/reference/js-reference).
// No @types package is installed for GIS — these are only the fields used
// here, not the full API surface.
type GoogleIdConfiguration = {
  client_id: string;
  callback: (response: { credential: string }) => void;
  nonce: string;
  use_fedcm_for_prompt?: boolean;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
};

type GoogleButtonConfiguration = {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  shape?: "rectangular" | "pill" | "circle" | "square";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  width?: number;
};

type GooglePromptMomentNotification = {
  isDismissedMoment(): boolean;
  getDismissedReason(): string;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: GoogleIdConfiguration): void;
          renderButton(parent: HTMLElement, options: GoogleButtonConfiguration): void;
          prompt(callback?: (notification: GooglePromptMomentNotification) => void): void;
        };
      };
    };
  }
}

type Props = {
  next?: string;
  /** The existing redirect-flow sign-in, used verbatim as the fallback when
   * GIS can't load (SignInClient.tsx's onGoogle). */
  onRedirectFallback(): void;
  onError(error: "google-cancelled" | "generic"): void;
};

/**
 * Google Identity Services (GIS) "Sign in with Google", rendered on our own
 * page so Google's account chooser shows this site's origin instead of
 * `<ref>.supabase.co` (docs/stayover/STATUS.md, decided 2026-09-24). Falls
 * back to the existing Supabase-redirect flow when GIS can't load — see
 * decideGoogleSignInMode in google-sign-in-support.ts.
 */
export function GoogleSignIn({ next, onRedirectFallback, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<GoogleScriptStatus>("pending");
  const clientId = googleClientId();
  const mode = decideGoogleSignInMode(clientId, status);

  useEffect(() => {
    if (!clientId) return;
    const timer = setTimeout(() => {
      setStatus((current) => (current === "pending" ? "timeout" : current));
    }, LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [clientId]);

  useEffect(() => {
    if (mode !== "gis" || !containerRef.current || typeof window === "undefined" || !window.google) {
      return;
    }
    const google = window.google;
    const container = containerRef.current;
    const rawNonce = generateRawNonce();
    let cancelled = false;

    async function handleCredential(credential: string) {
      const supabase = createClient();
      // Supabase's Google provider already has this same Client ID
      // registered under Authentication -> Providers -> Google -> "Client
      // IDs" — that's the audience signInWithIdToken checks the token's
      // `aud` claim against, and nonce checks stay ON (setup.md §4).
      const { error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: credential,
        nonce: rawNonce,
      });
      if (error) {
        onError("generic");
        return;
      }
      window.location.assign(safeNextPath(next, window.location.origin));
    }

    async function setup() {
      const hashedNonce = await sha256Hex(rawNonce);
      if (cancelled) return;

      google.accounts.id.initialize({
        client_id: clientId as string,
        callback: (response) => void handleCredential(response.credential),
        nonce: hashedNonce,
        use_fedcm_for_prompt: true,
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      google.accounts.id.renderButton(container, {
        type: "standard",
        theme: "filled_black",
        shape: "pill",
        size: "large",
        text: "signin_with",
        width: Math.min(container.clientWidth || 400, 400),
      });
      google.accounts.id.prompt((notification) => {
        const cancelledError = mapPromptDismissal(
          notification.isDismissedMoment(),
          notification.getDismissedReason(),
        );
        if (cancelledError) onError(cancelledError);
      });
    }

    void setup();
    return () => {
      cancelled = true;
    };
    // next/onError are read at call time via closures kept fresh below; the
    // effect intentionally only re-runs on mode/clientId — re-running on
    // every render of the parent would re-initialize GIS and show a second
    // prompt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, clientId]);

  if (!clientId || mode === "fallback") {
    return (
      <Button variant="secondary" fullWidth onClick={onRedirectFallback}>
        Sign in with Google
      </Button>
    );
  }

  return (
    <>
      <Script
        src={SCRIPT_SRC}
        strategy="afterInteractive"
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
      />
      <div ref={containerRef} className="flex justify-center" />
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import type { SignInProps } from "../types";
import { Card } from "../Card";
import { Banner } from "../Banner";
import { Button } from "../Button";
import { TextField } from "../TextField";
import { formatCountdown } from "../format";

const errorMessages: Record<NonNullable<SignInProps["error"]>, string> = {
  "link-expired": "That sign-in link has expired or already been used. Request a new one below.",
  "google-cancelled": "Google sign-in was cancelled. Try again, or email yourself a link instead.",
  generic: "Something went wrong signing you in. Please try again.",
  "account-unavailable":
    "We couldn't load your account. Please try again in a moment — if this keeps happening, the app may still be being set up.",
};

export function SignIn({ error, onRequestLink, onGoogle, googleSlot }: SignInProps) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [message, setMessage] = useState<string | undefined>(undefined);
  // Seconds left before "Email me a sign-in link" can be pressed again,
  // driven by ActionResult.retryAfterSeconds on a rate-limited request.
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  async function handleRequestLink() {
    setBusy(true);
    setMessage(undefined);
    const result = await onRequestLink(email);
    setBusy(false);
    if (result.ok) {
      setSentTo(email);
    } else {
      setMessage(result.message);
      setCooldown(result.retryAfterSeconds ?? 0);
    }
  }

  const isCoolingDown = cooldown > 0;

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <Card letterhead className="w-full max-w-md">
        <p className="font-display text-[32px] font-semibold text-text">Lyanne Visa</p>
        <p className="mt-1 text-[17px] text-muted">Sign in to continue.</p>

        {error ? (
          <Banner variant="attention" title="Couldn't sign you in" className="mt-4">
            {errorMessages[error]}
          </Banner>
        ) : null}

        {sentTo ? (
          <Banner variant="neutral" title="Check your email" className="mt-4">
            We sent a sign-in link to {sentTo}.
          </Banner>
        ) : (
          <div className="mt-5 flex flex-col gap-4">
            <TextField
              label="Email"
              type="email"
              value={email}
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              errorText={message}
            />
            <Button
              variant="primary"
              fullWidth
              busy={busy}
              disabled={!email || isCoolingDown}
              onClick={handleRequestLink}
            >
              {isCoolingDown ? `Send again in ${formatCountdown(cooldown)}` : "Email me a sign-in link"}
            </Button>
            {isCoolingDown ? (
              <p aria-live="polite" className="text-[15px] text-muted">
                Check your inbox — the last link may already be there.
              </p>
            ) : null}
            <div className="flex items-center gap-3 text-muted">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[15px]">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            {googleSlot ?? (
              <Button variant="secondary" fullWidth onClick={onGoogle}>
                Sign in with Google
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

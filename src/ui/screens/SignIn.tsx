"use client";

import { useState } from "react";
import type { SignInProps } from "../types";
import { Card } from "../Card";
import { Banner } from "../Banner";
import { Button } from "../Button";
import { TextField } from "../TextField";

const errorMessages: Record<NonNullable<SignInProps["error"]>, string> = {
  "link-expired": "That sign-in link has expired or already been used. Request a new one below.",
  "google-cancelled": "Google sign-in was cancelled. Try again, or email yourself a link instead.",
  generic: "Something went wrong signing you in. Please try again.",
  "account-unavailable":
    "We couldn't load your account. Please try again in a moment — if this keeps happening, the app may still be being set up.",
};

export function SignIn({ error, onRequestLink, onGoogle }: SignInProps) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [message, setMessage] = useState<string | undefined>(undefined);

  async function handleRequestLink() {
    setBusy(true);
    setMessage(undefined);
    const result = await onRequestLink(email);
    setBusy(false);
    if (result.ok) {
      setSentTo(email);
    } else {
      setMessage(result.message);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <Card className="w-full max-w-md">
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
              disabled={!email}
              onClick={handleRequestLink}
            >
              Email me a sign-in link
            </Button>
            <div className="flex items-center gap-3 text-muted">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[15px]">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <Button variant="secondary" fullWidth onClick={onGoogle}>
              Sign in with Google
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

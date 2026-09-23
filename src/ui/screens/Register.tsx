"use client";

import { useState } from "react";
import type { RegisterProps, Side } from "../types";
import { Card } from "../Card";
import { Button } from "../Button";
import { TextField } from "../TextField";

const roles: { value: Side; title: string; blurb: string }[] = [
  { value: "parent", title: "I'm a parent", blurb: "I'll ask for stays for my child." },
  { value: "host", title: "I'm a host", blurb: "I'll welcome Lyanne at my home." },
];

export function Register({ email, codeAttemptsLeft, onRegister, onSignOut }: RegisterProps) {
  const [role, setRole] = useState<Side | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);

  const codeAvailable = codeAttemptsLeft > 0;

  async function handleSubmit() {
    if (!role || !name.trim()) return;
    setBusy(true);
    setMessage(undefined);
    const result = await onRegister(role, name.trim(), code.trim() || undefined);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 px-4 py-10">
      <Card>
        <p className="font-display text-[32px] font-semibold text-text">Welcome</p>
        <p className="mt-1 text-[17px] text-muted">Signed in as {email}.</p>

        <p className="mt-5 text-[16px] font-bold text-text">Choose your role</p>
        <p className="text-[15px] text-muted">
          You can&apos;t change this later without asking the admin.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {roles.map((option) => {
            const selected = role === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setRole(option.value)}
                aria-pressed={selected}
                className={[
                  "rounded-2xl border p-4 text-left min-h-[48px]",
                  selected ? "border-accent ring-2 ring-accent" : "border-border",
                ].join(" ")}
              >
                <p className="text-[17px] font-bold text-text">{option.title}</p>
                <p className="mt-1 text-[15px] text-muted">{option.blurb}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-col gap-4">
          <TextField
            label="Your name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />

          {codeAvailable ? (
            <TextField
              label="Family code (optional)"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              helperText="Don't have one? Leave it blank — the admin will approve you."
              errorText={message}
            />
          ) : (
            <p className="text-[15px] text-muted">
              No attempts left for the family code — register below and the admin will
              approve your account.
            </p>
          )}

          {message && codeAvailable ? (
            <p className="text-[15px] text-muted">
              That code isn&apos;t right — try again, or{" "}
              <button
                type="button"
                onClick={() => setCode("")}
                className="font-semibold text-accent underline underline-offset-2"
              >
                leave it blank
              </button>{" "}
              to ask the admin.
            </p>
          ) : null}

          <Button
            variant="primary"
            fullWidth
            busy={busy}
            disabled={!role || !name.trim()}
            onClick={handleSubmit}
          >
            Register
          </Button>

          <Button variant="quiet" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </Card>
    </div>
  );
}

// Gmail SMTP adapter for the `Mailer` port (design.md Decision c;
// ARCHITECTURE.md §5 "v1's adapter is Gmail SMTP from a dedicated app
// account"). `nodemailer` is the de facto standard Node SMTP client
// (design.md Decision c).
//
// The three env vars this reads — `DELIVERY_SMTP_USER`,
// `DELIVERY_SMTP_APP_PASSWORD`, `DELIVERY_FROM_ADDRESS` — are server-only
// (never `NEXT_PUBLIC_`, ARCHITECTURE.md §6 rule 6 "secrets stay
// server-side") and are read ONLY inside this module: nothing outside
// mailer-smtp.ts ever touches `process.env.DELIVERY_SMTP_*` directly, so a
// credential can never leak into a client bundle or another adapter by
// accident (verified by mailer.test.ts's import-boundary test).

import nodemailer from "nodemailer";
import type { EmailMessage, Mailer, SendResult } from "./types";

// Next.js only inlines NEXT_PUBLIC_* vars when referenced statically
// (`process.env.NEXT_PUBLIC_...`); this codebase's convention (see
// src/stayover/supabase/env.ts and its env.test.ts regression guard) is to
// never read an env var through a bracketed, dynamically-computed key
// anywhere under src/ at all, so every getter below reads its own var by a
// statically-written dotted name.
function checkEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/** The Gmail SMTP account nodemailer authenticates as. */
export function smtpUser(): string {
  return checkEnv("DELIVERY_SMTP_USER", process.env.DELIVERY_SMTP_USER);
}

/** The Gmail app password (16 characters, from setup.md's Gmail app-password step). */
export function smtpAppPassword(): string {
  return checkEnv("DELIVERY_SMTP_APP_PASSWORD", process.env.DELIVERY_SMTP_APP_PASSWORD);
}

/** The organizer/From address used on notices and invites. */
export function fromAddress(): string {
  return checkEnv("DELIVERY_FROM_ADDRESS", process.env.DELIVERY_FROM_ADDRESS);
}

/** True iff every SMTP env var this adapter needs is present — used by mailer.ts to choose an adapter. */
export function smtpConfigured(): boolean {
  return Boolean(
    process.env.DELIVERY_SMTP_USER &&
      process.env.DELIVERY_SMTP_APP_PASSWORD &&
      process.env.DELIVERY_FROM_ADDRESS,
  );
}

export function createSmtpMailer(): Mailer {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // STARTTLS on 587, matching setup.md §3's custom-SMTP config
    auth: {
      user: smtpUser(),
      pass: smtpAppPassword(),
    },
  });

  return {
    async send(message: EmailMessage): Promise<SendResult> {
      try {
        await transporter.sendMail({
          from: fromAddress(),
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
          icalEvent: message.icsAttachment
            ? {
                filename: message.icsAttachment.filename,
                method: message.icsAttachment.method,
                content: message.icsAttachment.content,
              }
            : undefined,
        });
        return { ok: true };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        return { ok: false, error };
      }
    },
  };
}

// `Mailer` adapter selection (task 4.1; design.md Decision c). Picks the
// Gmail SMTP adapter when every credential it needs is present
// (`smtpConfigured()`, mailer-smtp.ts), and falls back to the console/test
// double otherwise — which is the case by default in test and local dev
// before anyone has set the three DELIVERY_SMTP_*/DELIVERY_FROM_ADDRESS env
// vars (setup.md documents that one-time step).

import { createConsoleMailer } from "./mailer-console";
import { createSmtpMailer, smtpConfigured } from "./mailer-smtp";
import type { Mailer } from "./types";

/**
 * Returns the Gmail SMTP adapter if `DELIVERY_SMTP_USER`,
 * `DELIVERY_SMTP_APP_PASSWORD` and `DELIVERY_FROM_ADDRESS` are all set, and
 * the console/test double otherwise (test/dev default).
 */
export function getMailer(): Mailer {
  return smtpConfigured() ? createSmtpMailer() : createConsoleMailer();
}

export { createConsoleMailer } from "./mailer-console";
export { createSmtpMailer, smtpConfigured } from "./mailer-smtp";

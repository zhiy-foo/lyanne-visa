// Console/test double for the `Mailer` port (design.md Decision c;
// ARCHITECTURE.md §5 "Placements": "two parallel realisations of one
// contract"). Used by default in test/dev when the SMTP env vars are absent
// (see mailer.ts's `getMailer`) — never touches the network, so
// `Stayover ⋈ ConsoleMailer` is a valid test composite with no change to
// either core (ARCHITECTURE.md §9 Law 4).

import type { EmailMessage, Mailer, SendResult } from "./types";

export interface ConsoleMailerOptions {
  /** Injectable sink so tests can capture output instead of writing to stdout. */
  log?: (line: string) => void;
}

export function createConsoleMailer(options: ConsoleMailerOptions = {}): Mailer {
  const log = options.log ?? ((line: string) => console.log(line));

  return {
    async send(message: EmailMessage): Promise<SendResult> {
      log(
        `[console-mailer] to=${message.to} subject=${JSON.stringify(message.subject)}` +
          (message.icsAttachment ? ` ics-method=${message.icsAttachment.method}` : ""),
      );
      return { ok: true };
    },
  };
}

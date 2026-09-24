// renderInvite: the email body that accompanies a calendar `.ics` attachment
// (ui-design-brief.md §6 template 2 — "Calendar invite"). Separate from
// renderNotice (task 3.3 covers notices only; ARCHITECTURE.md §7 lists
// `renderIcs`/`sendEmail ⊸` as the invite's own realising atoms) but the
// same plain-HTML-with-full-text-fallback convention.

import type { CalendarEvent, EmailMessage } from "./types";
import { renderIcs } from "./render-ics";

export interface InviteFacts {
  to: string;
  childName: string;
  placeName: string;
  event: CalendarEvent;
  appUrl?: string;
}

function subjectPrefix(event: CalendarEvent): string {
  if (event.method === "CANCEL") return "Cancelled:";
  return event.sequence <= 1 ? "Confirmed:" : "Updated:";
}

function formatSpan(event: CalendarEvent): string {
  return `${event.span.start} to ${event.span.end}`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** The invite email's body (the `.ics` itself is attached by the caller — see dispatch-render.ts). */
export function renderInvite(facts: InviteFacts): EmailMessage {
  const { event } = facts;
  const span = formatSpan(event);
  const subject = `${subjectPrefix(event)} ${facts.childName} at ${facts.placeName}, ${span}`;
  const link = facts.appUrl ? `${facts.appUrl.replace(/\/$/, "")}` : undefined;

  const bodyLines =
    event.method === "CANCEL"
      ? [`The stay for ${facts.childName} at ${facts.placeName} (${span}) has been cancelled.`, "The calendar event attached will be removed from your calendar."]
      : [
          `${facts.childName}'s stay at ${facts.placeName} is confirmed for ${span}.`,
          event.location ? `Location: ${event.location}` : "",
          "A calendar invite is attached — accepting it adds or updates the event in your own calendar.",
        ].filter(Boolean);

  const textLines = [subject, "", ...bodyLines];
  if (link) textLines.push("", `Open the stay: ${link}`);
  const text = textLines.join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,-apple-system,sans-serif;">
    <table role="presentation" width="100%" style="max-width:600px;margin:0 auto;padding:24px;">
      <tr><td>
        <h1 style="font-size:20px;color:#111;margin:0 0 12px;">${escapeHtml(subject)}</h1>
        ${bodyLines.map((line) => `<p style="font-size:16px;line-height:1.5;color:#333;margin:0 0 12px;">${escapeHtml(line)}</p>`).join("\n        ")}
        ${link ? `<p style="margin:20px 0;"><a href="${link}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Open the stay</a></p>` : ""}
      </td></tr>
    </table>
  </body>
</html>`;

  return {
    to: facts.to,
    subject,
    text,
    html,
    icsAttachment: {
      filename: event.method === "CANCEL" ? "cancellation.ics" : "invite.ics",
      content: renderIcs(event),
      method: event.method,
    },
  };
}

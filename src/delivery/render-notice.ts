// renderNotice (task 3.3; docs/delivery/ARCHITECTURE.md §7 `renderNotice`):
// a pure function producing a plain HTML+text email for every NOTICE kind
// (turn notice, declined, cancelled, withdrawn, waiting) per
// docs/stayover/general/ui-design-brief.md §6 ("Plain, readable HTML ...
// all information also present as text").
//
// Signature deviation from ARCHITECTURE.md §7's literal
// `StayoverEvent × Member → EmailMessage`: this takes a flat `NoticeFacts`
// object instead of `src/delivery/events.ts`'s richer `StayoverEvent`,
// because at render time (send-pending-dispatches wiring, task 4.2) the only
// input available is `dispatch.payload` — the jsonb snapshot taken at queue
// time (20260924001200_delivery_queue.sql's migration header explains the
// "payload snapshot, not a secret-gated read" choice) — which is already
// this flat shape, not a reconstructed StayoverEvent. `events.ts`'s
// `StayoverEvent`/`planDelivery` remain the model this shape is drawn from
// and are cross-checked against the SQL side (task 3.4); this function is
// the one that actually runs at send time.

import type { EmailMessage } from "./types";

export type NoticeKind = "propose" | "accept" | "reject" | "cancel" | "withdrawn" | "waiting";

export interface NoticeFacts {
  kind: NoticeKind;
  to: string;
  childName?: string;
  placeName?: string;
  moverName?: string;
  moverSide?: "parent" | "host";
  note?: string;
  dateStart?: string;
  dateEnd?: string;
  applicationId?: string;
  personName?: string; // waiting only
  role?: string; // waiting only
  /** Base app URL for the "Open the application" link; omitted in tests that don't need it. */
  appUrl?: string;
}

function formatDateRange(start?: string, end?: string): string | undefined {
  if (!start || !end) return undefined;
  return `${start} to ${end}`;
}

function applicationLink(facts: NoticeFacts): string | undefined {
  if (!facts.appUrl || !facts.applicationId) return undefined;
  return `${facts.appUrl.replace(/\/$/, "")}/applications/${facts.applicationId}`;
}

interface Copy {
  subject: string;
  heading: string;
  bodyLines: string[]; // each also rendered as its own <p> in the HTML
}

function copyFor(facts: NoticeFacts): Copy {
  const dates = formatDateRange(facts.dateStart, facts.dateEnd);
  const child = facts.childName ?? "the child";
  const place = facts.placeName ?? "the home";
  const mover = facts.moverName ?? "Someone";

  switch (facts.kind) {
    case "propose":
      return {
        subject: dates ? `${mover} asked for ${child} to stay ${dates}` : `${mover} asked about a stay for ${child}`,
        heading: "Your answer is needed",
        bodyLines: [
          `${mover} ${facts.moverSide === "host" ? "suggested" : "asked for"} ${child} to stay at ${place}${dates ? ` from ${dates}` : ""}.`,
          ...(facts.note ? [`Their note: "${facts.note}"`] : []),
        ],
      };
    case "accept":
      return {
        subject: `Good news — ${place} confirmed ${child}'s stay${dates ? ` (${dates})` : ""}`,
        heading: "Your proposal was accepted",
        bodyLines: [
          `${place} accepted the dates you proposed for ${child}${dates ? `, ${dates}` : ""}.`,
          "A calendar invite is on its way separately.",
        ],
      };
    case "reject":
      return {
        subject: `${place} can't do those dates for ${child}`,
        heading: "Your proposal was declined",
        bodyLines: [
          `${place} isn't able to do the dates you proposed for ${child}${dates ? ` (${dates})` : ""}.`,
          ...(facts.note ? [`Their note: "${facts.note}"`] : []),
          "Feel free to suggest other dates.",
        ],
      };
    case "cancel":
      return {
        subject: `${child}'s stay at ${place} was cancelled`,
        heading: "A stay was cancelled",
        bodyLines: [
          `${mover} cancelled ${child}'s stay at ${place}${dates ? ` (${dates})` : ""}.`,
          ...(facts.note ? [`Their note: "${facts.note}"`] : []),
        ],
      };
    case "withdrawn":
      return {
        subject: `A request for ${child} was withdrawn`,
        heading: "Request withdrawn",
        bodyLines: [`The request for ${child} to stay at ${place}${dates ? ` (${dates})` : ""} was withdrawn.`],
      };
    case "waiting":
      return {
        subject: `${facts.personName ?? "Someone"} is waiting for approval`,
        heading: "A new account is waiting",
        bodyLines: [
          `${facts.personName ?? "Someone"} registered as a ${facts.role ?? "member"} without the family join code and is waiting for your approval.`,
        ],
      };
  }
}

/** `renderNotice` (task 3.3) — see this file's header for the signature note. */
export function renderNotice(facts: NoticeFacts): EmailMessage {
  const copy = copyFor(facts);
  const link = applicationLink(facts);

  const textLines = [copy.heading, "", ...copy.bodyLines];
  if (link) textLines.push("", `Open the application: ${link}`);
  const text = textLines.join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,-apple-system,sans-serif;">
    <table role="presentation" width="100%" style="max-width:600px;margin:0 auto;padding:24px;">
      <tr><td>
        <h1 style="font-size:20px;color:#111;margin:0 0 12px;">${copy.heading}</h1>
        ${copy.bodyLines.map((line) => `<p style="font-size:16px;line-height:1.5;color:#333;margin:0 0 12px;">${escapeHtml(line)}</p>`).join("\n        ")}
        ${link ? `<p style="margin:20px 0;"><a href="${link}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Open the application</a></p>` : ""}
      </td></tr>
    </table>
  </body>
</html>`;

  return { to: facts.to, subject: copy.subject, text, html };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// renderDispatch: task 4.2's `render` dependency, wired for real. Turns one
// claimed `DispatchRow` (its `payload` is the jsonb snapshot taken at queue
// time by 20260924001200_delivery_queue.sql) into an `EmailMessage`, using
// renderNotice (task 3.3) for `kind === "notice"` and buildEvent + renderIcs
// + renderInvite (tasks 3.1, 3.2, and render-invite.ts) for `kind ===
// "invite"`. Pure given its `organizer`/`appUrl` inputs — no I/O of its own,
// so it is unit-testable without a database (send-pending-dispatches.server.ts
// is the only caller that reads env for those two inputs).

import type { DispatchRow } from "./send-pending-dispatches";
import type { EmailMessage } from "./types";
import { renderNotice } from "./render-notice";
import type { NoticeFacts, NoticeKind } from "./render-notice";
import { buildEvent } from "./build-event";
import type { CalendarFacts } from "./build-event";
import { renderInvite } from "./render-invite";

export interface RenderDispatchOptions {
  /** `ev_organizer` — the app's sending address (DELIVERY_FROM_ADDRESS). */
  organizer: string;
  /** Base app URL for links in the email body (NEXT_PUBLIC_SITE_URL). */
  appUrl?: string;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function renderNoticeDispatch(dispatch: DispatchRow, options: RenderDispatchOptions): EmailMessage {
  const p = dispatch.payload;
  const facts: NoticeFacts = {
    kind: (str(p.notice_kind) as NoticeKind) ?? "propose",
    to: dispatch.toEmail,
    childName: str(p.child_name),
    placeName: str(p.place_name),
    moverName: str(p.mover_name),
    moverSide: str(p.mover_side) as "parent" | "host" | undefined,
    note: str(p.note),
    dateStart: str(p.date_start),
    dateEnd: str(p.date_end),
    applicationId: str(p.application_id) ?? dispatch.applicationId ?? undefined,
    personName: str(p.person_name),
    role: str(p.role),
    appUrl: options.appUrl,
  };
  return renderNotice(facts);
}

function renderInviteDispatch(dispatch: DispatchRow, options: RenderDispatchOptions): EmailMessage {
  const p = dispatch.payload;
  const method = str(p.method) === "CANCEL" ? "cancelled" : "confirmed";
  const applicationId = str(p.application_id) ?? dispatch.applicationId;
  const dateStart = str(p.date_start);
  const dateEnd = str(p.date_end);
  if (!applicationId || !dateStart || !dateEnd) {
    throw new Error(`invite dispatch ${dispatch.id} is missing required calendar facts in its payload`);
  }

  const facts: CalendarFacts = {
    applicationId,
    agreed: { start: dateStart, end: dateEnd },
    revision: dispatch.revision,
    phase: method === "cancelled" ? "cancelled" : "confirmed",
    placeTimeZone: str(p.time_zone) ?? "UTC",
    placeAddress: str(p.place_address),
    childName: str(p.child_name) ?? "the child",
    placeName: str(p.place_name) ?? "the home",
    attendees: Array.isArray(p.attendees) ? (p.attendees as unknown[]).filter((e): e is string => typeof e === "string") : [dispatch.toEmail],
    organizer: options.organizer,
  };

  const event = buildEvent(facts);
  return renderInvite({
    to: dispatch.toEmail,
    childName: facts.childName,
    placeName: facts.placeName,
    event,
    appUrl: options.appUrl,
  });
}

/** `render` (task 4.2's `SendPendingDispatchesDeps.render`), wired for real. */
export function renderDispatch(dispatch: DispatchRow, options: RenderDispatchOptions): EmailMessage {
  return dispatch.kind === "invite" ? renderInviteDispatch(dispatch, options) : renderNoticeDispatch(dispatch, options);
}

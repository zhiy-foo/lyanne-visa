// Pure presentational helper for ApplicationDetail.tsx's quiet delivery-status
// line (ui-design-brief.md §5 "Stage 4"). Kept out of format.ts (which is
// date/time-only) since this is domain wording, not a formatter.

/** "Calendar invite sent to 1 of 1 person" / "Calendar invites sent to 2 of
 * 3 people" — singular ("invite"/"person") exactly when there is only one
 * recipient in total (regardless of how many of them have been sent to so
 * far); every other total reads as plural. */
export function formatInviteStatus(sent: number, total: number): string {
  const singular = total === 1;
  const invite = singular ? "invite" : "invites";
  const person = singular ? "person" : "people";
  return `Calendar ${invite} sent to ${sent} of ${total} ${person}.`;
}

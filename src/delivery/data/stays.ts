import "server-only";
import { createClient } from "../../stayover/supabase/server";

/** ui-design-brief.md §5 "Stage 4"'s quiet delivery-status line — kept in
 * src/delivery/ (not src/stayover/data/stays.ts) so Stayover's own data
 * loaders stay free of any Delivery-owned read, matching Law 4: Delivery
 * depends on Stayover's port, never the other way around. The page
 * composes this alongside loadApplicationDetail (src/app/applications/[id]/page.tsx). */
export type ApplicationDeliveryStatus = { sent: number; total: number; failedRecipient?: string };

type Row = { sent: number; total: number; failed_recipient_name: string | null };

/** `application_dispatch_summary` (20260924001200_delivery_queue.sql) —
 * returns `undefined` (not shown at all) when nothing has ever been queued
 * for this application yet, or when the read itself fails for any reason —
 * this is a quiet, non-critical line; it must never turn into a page error. */
export async function loadApplicationDeliveryStatus(
  applicationId: string,
): Promise<ApplicationDeliveryStatus | undefined> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("application_dispatch_summary", { p_application: applicationId });
  if (error) return undefined;

  const row = (Array.isArray(data) ? data[0] : data) as Row | undefined;
  if (!row || row.total === 0) return undefined;

  return { sent: row.sent, total: row.total, failedRecipient: row.failed_recipient_name ?? undefined };
}

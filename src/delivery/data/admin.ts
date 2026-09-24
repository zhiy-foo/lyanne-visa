import "server-only";
import { createClient } from "../../stayover/supabase/server";

export type AdminFailedDispatch = {
  id: string;
  kind: "notice" | "invite";
  toEmail: string;
  lastError: string;
  updatedAt: string;
};

type Row = { id: string; kind: string; to_email: string; last_error: string | null; updated_at: string };

/** Task 5.1: admin_failed_dispatches() (20260924001200_delivery_queue.sql) —
 * admin-only at the database level too; this loader adds nothing beyond
 * mapping the row shape (no SMTP config or credentials are in the
 * projection at all). */
export async function loadAdminFailedDispatches(): Promise<AdminFailedDispatch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_failed_dispatches");
  if (error) throw new Error(typeof error === "object" ? JSON.stringify(error) : String(error));

  return ((data ?? []) as Row[]).map((row) => ({
    id: row.id,
    kind: row.kind as "notice" | "invite",
    toEmail: row.to_email,
    lastError: row.last_error ?? "Unknown error",
    updatedAt: row.updated_at,
  }));
}

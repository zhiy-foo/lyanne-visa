import "server-only";
import { createClient } from "./supabase/server";
import { mapMyAccountRow, type MyAccount, type MyAccountRow } from "./routing";

/**
 * The caller's own account, from `my_account()` (reads RLS itself would hide
 * from a waiting/deactivated/admin/unregistered caller — see that
 * function's comment in 20260924000300_foundation_functions.sql). `null`
 * means signed out.
 */
export async function getAccount(): Promise<MyAccount | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.rpc("my_account");
  if (error || !data || data.length === 0) {
    return null;
  }

  return mapMyAccountRow(data[0] as MyAccountRow);
}

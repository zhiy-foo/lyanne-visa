import "server-only";
import { createClient } from "./supabase/server";
import { classifyMyAccountRpc, type MyAccount, type MyAccountRow } from "./routing";

/**
 * Outcome of loading the caller's own account: signed out; signed in with an
 * account (possibly `null` if they're signed in but have no member row yet
 * — see routing.ts's MyAccountOutcome "none"); or signed in but the
 * `my_account()` RPC itself failed (e.g. the hosted database hasn't had its
 * migrations pushed yet). Callers must not fold "error" into "signed out" —
 * that silently bounces a signed-in person to /sign-in with no explanation.
 */
export type AccountOutcome =
  | { kind: "signed-out" }
  | { kind: "account"; account: MyAccount | null }
  | { kind: "error" };

export async function getAccountOutcome(): Promise<AccountOutcome> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { kind: "signed-out" };

  const { data, error } = await supabase.rpc("my_account");
  const outcome = classifyMyAccountRpc(data as MyAccountRow[] | null, error);
  if (outcome.kind === "error") {
    console.error("getAccountOutcome: my_account() RPC failed", error);
    return { kind: "error" };
  }
  return { kind: "account", account: outcome.kind === "account" ? outcome.account : null };
}

/**
 * The caller's own account, from `my_account()` (reads RLS itself would hide
 * from a waiting/deactivated/admin/unregistered caller — see that
 * function's comment in 20260924000300_foundation_functions.sql). `null`
 * means signed out *or* signed in with no member row yet — callers that need
 * to tell an RPC error apart from either of those should use
 * getAccountOutcome() instead (e.g. src/stayover/route-guard.ts).
 */
export async function getAccount(): Promise<MyAccount | null> {
  const outcome = await getAccountOutcome();
  return outcome.kind === "account" ? outcome.account : null;
}

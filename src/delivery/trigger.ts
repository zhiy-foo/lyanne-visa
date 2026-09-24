// triggerDeliveryRetry: the one function server actions call from inside
// `after()` (task 4.3; design.md Decision b step 2). Wraps
// sendPendingDispatchesFromRequest so that ANY failure — a missing worker
// secret, an unreachable database, a thrown error from deep inside the send
// loop — is caught and logged here, never propagated. `after()`'s callback
// runs once the response has already been sent, so a throw from it cannot
// change what the user saw, but Next.js still surfaces an unhandled
// rejection to server logs; catching it here keeps that log line
// unsurprising and keeps the "delivery never blocks or fails the triggering
// action" guarantee true even for a caller that forgets to wrap the call
// itself.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPendingDispatchesFromRequest } from "./send-pending-dispatches.server";

export async function triggerDeliveryRetry(supabase: SupabaseClient): Promise<void> {
  try {
    await sendPendingDispatchesFromRequest(supabase);
  } catch (err) {
    console.error("[delivery] sendPendingDispatchesFromRequest failed", err);
  }
}

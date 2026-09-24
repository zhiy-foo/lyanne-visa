"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ActionResult, Side } from "@/ui/types";
import { createClient } from "../supabase/server";
import { mapDbError } from "../errors";
import { validateName } from "../validation";
import { triggerDeliveryRetry } from "@/delivery/trigger";

type RegisterRow = { outcome: "active" | "waiting" | "wrong_code"; member_id: string | null; attempts_left: number };

/** Registers the signed-in caller as a parent or host (account-access spec
 * "Registering an account with one role"). Redirects on success — active
 * accounts land on /home, waiting accounts on /waiting — and only returns
 * an ActionResult for the refusal paths the Register screen renders inline. */
export async function register(role: Side, name: string, code?: string): Promise<ActionResult> {
  const nameCheck = validateName(name);
  if (!nameCheck.ok) return nameCheck;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register", {
    p_role: role,
    p_name: nameCheck.value,
    p_code: code && code.trim() ? code.trim() : null,
  });

  if (error) {
    return { ok: false, message: mapDbError(error) };
  }

  const row = (Array.isArray(data) ? data[0] : data) as RegisterRow | undefined;
  if (!row) {
    return { ok: false, message: "Something went wrong. Please try again." };
  }

  if (row.outcome === "wrong_code") {
    revalidatePath("/register");
    const message =
      row.attempts_left > 0
        ? "That code isn't right — try again, or leave it blank to join the waiting list."
        : "That code isn't right, and there are no attempts left — leave it blank to join the waiting list and the admin will approve you.";
    return { ok: false, message };
  }

  // design.md Decision b step 2 (task 4.3): best-effort flush of whatever
  // register() just queued (a MemberWaiting notice to the admin, only on
  // the 'waiting' outcome — 20260924001200_delivery_queue.sql). Registered
  // before redirect() (which throws) so it always gets scheduled.
  after(() => triggerDeliveryRetry(supabase));

  revalidatePath("/home");
  revalidatePath("/waiting");

  if (row.outcome === "active") {
    redirect("/home");
  }
  redirect("/waiting");
}

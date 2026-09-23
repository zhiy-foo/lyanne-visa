"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/ui/types";
import { createClient } from "../supabase/server";
import { mapDbError } from "../errors";
import { validateAddress, validateEmail, validateName } from "../validation";

type HomeInput = { name: string; address?: string; timeZone: string };

/** children-and-homes spec "Hosts add their homes". The time zone is
 * validated authoritatively by add_place/update_place (design.md Decision
 * 9) — this only enforces the address length cap before it ever reaches
 * the database. */
export async function addHome(input: HomeInput): Promise<ActionResult> {
  const nameCheck = validateName(input.name);
  if (!nameCheck.ok) return nameCheck;
  const addressCheck = validateAddress(input.address);
  if (!addressCheck.ok) return addressCheck;

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_place", {
    p_name: nameCheck.value,
    p_address: addressCheck.value,
    p_time_zone: input.timeZone,
  });
  if (error) return { ok: false, message: mapDbError(error) };

  revalidatePath("/home");
  return { ok: true };
}

/** Shared by the host's own home page and the admin page — `update_place`
 * authorizes a host of the place OR the admin. */
export async function updateHome(homeId: string, input: HomeInput): Promise<ActionResult> {
  const nameCheck = validateName(input.name);
  if (!nameCheck.ok) return nameCheck;
  const addressCheck = validateAddress(input.address);
  if (!addressCheck.ok) return addressCheck;

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_place", {
    p_place: homeId,
    p_name: nameCheck.value,
    p_address: addressCheck.value,
    p_time_zone: input.timeZone,
  });
  if (error) return { ok: false, message: mapDbError(error) };

  revalidatePath("/home");
  revalidatePath("/admin");
  return { ok: true };
}

/** children-and-homes spec "Co-hosts and editing homes" (add). */
export async function addCoHost(homeId: string, email: string): Promise<ActionResult> {
  const check = validateEmail(email);
  if (!check.ok) return check;

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_host", { p_place: homeId, p_email: check.value });
  if (error) return { ok: false, message: mapDbError(error) };

  revalidatePath("/home");
  return { ok: true };
}

/** children-and-homes spec "Co-hosts and editing homes" (remove). */
export async function removeHost(homeId: string, memberId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_host", { p_place: homeId, p_member: memberId });
  if (error) return { ok: false, message: mapDbError(error) };

  revalidatePath("/home");
  return { ok: true };
}

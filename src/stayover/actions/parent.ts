"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/ui/types";
import { createClient } from "../supabase/server";
import { mapDbError } from "../errors";
import { validateEmail, validateName } from "../validation";

/** children-and-homes spec "Parents add their children". */
export async function addChild(name: string): Promise<ActionResult> {
  const check = validateName(name);
  if (!check.ok) return check;

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_child", { p_name: check.value });
  if (error) return { ok: false, message: mapDbError(error) };

  revalidatePath("/home");
  return { ok: true };
}

/** Shared by the parent's own home page and the admin page — `rename_child`
 * authorizes a guardian of the child OR the admin. */
export async function renameChild(childId: string, name: string): Promise<ActionResult> {
  const check = validateName(name);
  if (!check.ok) return check;

  const supabase = await createClient();
  const { error } = await supabase.rpc("rename_child", { p_child: childId, p_name: check.value });
  if (error) return { ok: false, message: mapDbError(error) };

  revalidatePath("/home");
  revalidatePath("/admin/children");
  return { ok: true };
}

/** children-and-homes spec "Co-parents" (add). */
export async function addCoParent(childId: string, email: string): Promise<ActionResult> {
  const check = validateEmail(email);
  if (!check.ok) return check;

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_guardian", { p_child: childId, p_email: check.value });
  if (error) return { ok: false, message: mapDbError(error) };

  revalidatePath("/home");
  return { ok: true };
}

/** children-and-homes spec "Co-parents" (remove). */
export async function removeParent(childId: string, memberId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_guardian", { p_child: childId, p_member: memberId });
  if (error) return { ok: false, message: mapDbError(error) };

  revalidatePath("/home");
  return { ok: true };
}

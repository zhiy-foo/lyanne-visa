"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult, Side } from "@/ui/types";
import { createClient } from "../supabase/server";
import { mapDbError } from "../errors";

// The admin area is split across three routes (/admin/accounts,
// /admin/children, /admin/homes) that all read from the same
// loadAdminData() call, and a change on one page can affect what another
// shows (e.g. linking a child changes that account's role-control state on
// the accounts page) — so every admin mutation revalidates all three.
function revalidateAdmin() {
  revalidatePath("/admin/accounts");
  revalidatePath("/admin/children");
  revalidatePath("/admin/homes");
}

/** account-access spec "Waiting list" (approve). */
export async function approveMember(memberId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_member", { p_member: memberId });
  if (error) return { ok: false, message: mapDbError(error) };
  revalidateAdmin();
  return { ok: true };
}

/** account-access spec "Waiting list" (decline). */
export async function declineMember(memberId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("decline_member", { p_member: memberId });
  if (error) return { ok: false, message: mapDbError(error) };
  revalidateAdmin();
  return { ok: true };
}

/** account-access spec "Admin account management" (deactivate). */
export async function deactivateMember(memberId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("deactivate_member", { p_member: memberId });
  if (error) return { ok: false, message: mapDbError(error) };
  revalidateAdmin();
  return { ok: true };
}

/** account-access spec "Admin account management" (reactivate). */
export async function reactivateMember(memberId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reactivate_member", { p_member: memberId });
  if (error) return { ok: false, message: mapDbError(error) };
  revalidateAdmin();
  return { ok: true };
}

/** account-access spec "Admin account management" (role change, refused
 * while linked). */
export async function setMemberRole(memberId: string, role: Side): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_role", { p_member: memberId, p_role: role });
  if (error) return { ok: false, message: mapDbError(error) };
  revalidateAdmin();
  return { ok: true };
}

/** account-access spec "Family join code". `code: null` clears it. */
export async function setJoinCode(code: string | null): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_join_code", { p_code: code });
  if (error) return { ok: false, message: mapDbError(error) };
  revalidateAdmin();
  return { ok: true };
}

/** children-and-homes spec "Admin can correct children, homes and links"
 * (parent links). */
export async function linkParent(childId: string, accountId: string, linked: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_guardian", {
    p_child: childId,
    p_member: accountId,
    p_linked: linked,
  });
  if (error) return { ok: false, message: mapDbError(error) };
  revalidateAdmin();
  return { ok: true };
}

/** children-and-homes spec "Admin can correct children, homes and links"
 * (host links). */
export async function linkHost(homeId: string, accountId: string, linked: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_host", {
    p_place: homeId,
    p_member: accountId,
    p_linked: linked,
  });
  if (error) return { ok: false, message: mapDbError(error) };
  revalidateAdmin();
  return { ok: true };
}

"use server";

import { redirect } from "next/navigation";
import type { ActionResult } from "@/ui/types";
import { createClient } from "../supabase/server";
import { siteUrl } from "../supabase/env";

/** Sends a one-time sign-in link (design.md Decision 8; account-access spec
 * "Sign in with an email link"). `next` is round-tripped through the
 * callback so the person lands back where they asked to go. */
export async function requestSignInLink(email: string, next?: string): Promise<ActionResult> {
  const trimmed = (email ?? "").trim();
  if (!trimmed) {
    return { ok: false, message: "Enter your email address." };
  }

  const supabase = await createClient();
  const search = next ? `?next=${encodeURIComponent(next)}` : "";
  const { error } = await supabase.auth.signInWithOtp({
    email: trimmed,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback${search}` },
  });

  if (error) {
    return { ok: false, message: "We couldn't send that link. Please try again." };
  }
  return { ok: true };
}

/** Ends the session (account-access spec "Signing out"). Available from
 * every signed-in page via AppShell/screen `onSignOut` props. */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

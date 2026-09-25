// Shared client-side helper for calling a server action from a busy/pending
// UI flow. A screen calls `runAction(() => onSomething(...))` in place of
// `await onSomething(...)`: if the action throws (e.g. a stale server action
// ID 404s after a redeploy, or any network error), runAction catches it and
// resolves to a failure ActionResult instead of letting the rejection
// propagate — so the caller's own `setBusy(false)` afterwards always runs
// and the button never gets stuck on "Working...".
//
// Deliberately doesn't manage the busy/message state itself: screens keep
// their own setBusy/setMessage calls around runAction, matching the
// existing call-site shape everywhere else in src/ui and keeping this a
// pure "make the await safe" helper.

import type { ActionResult } from "./types";

export const ACTION_FAILURE_MESSAGE = "Something went wrong. Please reload the page and try again.";

export async function runAction<T extends ActionResult>(
  action: () => Promise<T>,
): Promise<T | { ok: false; message: string; retryAfterSeconds?: number }> {
  try {
    return await action();
  } catch (error) {
    console.error(error);
    return { ok: false, message: ACTION_FAILURE_MESSAGE };
  }
}

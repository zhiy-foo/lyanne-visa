"use client";

import { AppShell } from "@/ui/AppShell";
import { renderScreen } from "./registry";

// Fixture callbacks (onApprove, onAddChild, ...) are plain functions, which
// can't cross the server → client boundary as props. So the Server Component
// page only resolves and validates the (serializable) screen key + state; the
// actual screen element — and its function props — is built here, entirely
// on the client side.
export function GalleryShell({ screenKey, state }: { screenKey: string; state?: string }) {
  const rendered = renderScreen(screenKey, state);
  if (!rendered) return null;

  return (
    <AppShell user={rendered.user} nav={rendered.nav} onSignOut={() => {}}>
      {rendered.node}
    </AppShell>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Applications } from "@/ui/screens/Applications";
import type { ApplicationsProps } from "@/ui/types";
import { dismissContactsTip } from "@/stayover/actions/stays";

// task 5.2's "one-time" tip (ui-design-brief.md §5 "Stage 4"): dismissal is
// remembered per-account, server-side (`member.contacts_tip_dismissed_at` —
// see 20260924001400_contacts_tip_dismissal.sql), not per-browser. The
// server (ApplicationsPage) reads it and passes the already-resolved
// `contactsTipDismissed` prop down, so the very first client render matches
// the server's HTML exactly — there is no client-only read (no
// localStorage) that could disagree with it, and so no hydration mismatch.
export function ApplicationsClient({
  appEmail,
  contactsTipDismissed,
  ...props
}: Omit<ApplicationsProps, "onOpen" | "onNew" | "contactsTip"> & {
  appEmail?: string;
  contactsTipDismissed: boolean;
}) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(contactsTipDismissed);

  function dismiss() {
    // Optimistic: hide immediately regardless of whether the write below
    // succeeds. This tip is low-stakes and repeatable, so a failed write
    // only means it may show again on a later visit — not worth surfacing
    // an error for.
    setDismissed(true);
    dismissContactsTip().catch((error) => {
      console.error("ApplicationsClient: dismissContactsTip failed", error);
    });
  }

  return (
    <Applications
      {...props}
      contactsTip={appEmail && !dismissed ? { appEmail, onDismiss: dismiss } : undefined}
      onOpen={(applicationId) => router.push(`/applications/${applicationId}`)}
      onNew={() => router.push("/applications/new")}
    />
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Applications } from "@/ui/screens/Applications";
import type { ApplicationsProps } from "@/ui/types";

// task 5.2's "one-time" tip (ui-design-brief.md §5 "Stage 4"): dismissal is
// remembered per-browser via localStorage — light-weight and enough for a
// quiet, non-critical tip; re-shown if the person clears storage or opens on
// a new device, which is an acceptable cost for something this low-stakes.
const DISMISSED_KEY = "lyanne-visa:contacts-tip-dismissed";

export function ApplicationsClient({
  appEmail,
  ...props
}: Omit<ApplicationsProps, "onOpen" | "onNew" | "contactsTip"> & { appEmail?: string }) {
  const router = useRouter();
  // Lazy initializer (not an effect) so there is no extra render just to
  // flip this from a default — `window` is unavailable during the server
  // render, so this reads as `false` there and is corrected on the client's
  // very first render, before paint.
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(DISMISSED_KEY) === "1",
  );

  function dismiss() {
    window.localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
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

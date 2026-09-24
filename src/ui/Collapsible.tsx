"use client";

import { useState } from "react";
import type { ReactNode } from "react";

export type CollapsibleProps = {
  /** The always-visible header — must stay short, it's also the summary's accessible name. */
  summary: ReactNode;
  /** Whether the card starts expanded or collapsed. Admin list cards (children,
   * homes) always pass false — each card is expanded deliberately, regardless
   * of how many items are in the list, to keep the collapsed state a real
   * privacy default rather than an incidental one. */
  defaultOpen: boolean;
  children: ReactNode;
  className?: string;
};

// Native <details>/<summary> — keyboard-operable (Enter/Space) and exposes
// expanded/collapsed state to assistive tech without any aria wiring, per
// the ui-design-brief's "native details/summary" option. Controlled by our
// own state (rather than left fully uncontrolled) so a re-render triggered
// by a sibling's data change never fights a person's own toggle.
export function Collapsible({ summary, defaultOpen, children, className = "" }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className={className}
    >
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 rounded-xl py-1 text-[17px] font-bold text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
        {summary}
        <span aria-hidden="true" className="shrink-0 text-muted">
          {open ? "▾" : "▸"}
        </span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

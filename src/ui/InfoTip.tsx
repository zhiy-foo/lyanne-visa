"use client";

import { useEffect, useRef, useState } from "react";

export type InfoTipEvent =
  | "hover-enter"
  | "hover-leave"
  | "focus"
  | "blur"
  | "toggle"
  | "escape"
  | "outside";

/** Pure reducer for InfoTip's open/closed state. Hover and keyboard focus
 * open it; hover-leave, blur, Escape and an outside tap close it; a click
 * toggles it (the path touch devices rely on, since they never fire hover).
 * Exported so the open/close rules can be unit tested without rendering. */
export function nextInfoTipOpen(open: boolean, event: InfoTipEvent): boolean {
  switch (event) {
    case "hover-enter":
    case "focus":
      return true;
    case "hover-leave":
    case "blur":
    case "escape":
    case "outside":
      return false;
    case "toggle":
      return !open;
    default:
      return open;
  }
}

// Visually hides the tooltip text without removing it from the
// accessibility tree, so a field's aria-describedby still reads it even
// while the visual bubble is closed.
const hiddenVisually =
  "absolute h-px w-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)]";
const visibleTooltip =
  "absolute left-1/2 top-full z-10 mt-1 w-max max-w-[220px] -translate-x-1/2 rounded-lg border border-border bg-surface-raised px-3 py-2 text-[13px] font-normal text-text shadow-lg";

export type InfoTipProps = {
  /** Accessible name for the trigger button, e.g. "Why can't I change the role?" */
  label: string;
  /** id placed on the tooltip bubble — pass this same id to the field's aria-describedby. */
  id: string;
  children: string;
  className?: string;
};

// Small circled "?" trigger: shows its tooltip on hover, keyboard focus and
// tap; dismisses on Escape, blur or an outside tap. The 44px hit area keeps
// it tappable even though the glyph itself is small.
export function InfoTip({ label, id, children, className = "" }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  function dispatch(event: InfoTipEvent) {
    setOpen((current) => nextInfoTipOpen(current, event));
  }

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") dispatch("escape");
    }
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        dispatch("outside");
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <span ref={rootRef} className={["relative inline-flex", className].join(" ")}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onMouseEnter={() => dispatch("hover-enter")}
        onMouseLeave={() => dispatch("hover-leave")}
        onFocus={() => dispatch("focus")}
        onBlur={() => dispatch("blur")}
        onClick={() => dispatch("toggle")}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span
          aria-hidden="true"
          className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-[13px] font-bold leading-none"
        >
          ?
        </span>
      </button>
      <span id={id} role="tooltip" className={open ? visibleTooltip : hiddenVisually}>
        {children}
      </span>
    </span>
  );
}

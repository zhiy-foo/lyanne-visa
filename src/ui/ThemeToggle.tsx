"use client";

import { useLayoutEffect, useState } from "react";

function readCurrentIsDark(): boolean {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark") return true;
  if (attr === "light") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export type ThemeToggleProps = { className?: string };

// Reads/writes the theme itself (localStorage + the <html data-theme> the
// inline bootstrap script also sets) — this is the one place in src/ui that
// touches browser storage directly, since there is no server state involved.
//
// Initial state is always `false` so server and first-client render match
// (the server has no way to know the real preference); a layout effect syncs
// it to the real value immediately after mount, before the browser paints.
export function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const [isDark, setIsDark] = useState(false);

  useLayoutEffect(() => {
    // Deliberately synchronous: this is the one-time hydration-safe read of
    // browser-only state (matchMedia / the attribute the inline bootstrap
    // script set) that the server render couldn't know.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(readCurrentIsDark());
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // storage unavailable (private browsing, etc.) — theme just won't persist
    }
  }

  return (
    // The visual pill stays 32px tall (h-8) to match the design, but the
    // button itself is padded out to a >=44x44 hit area so it meets the
    // minimum touch target size; the focus ring goes on this outer button.
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Dark mode"
      onClick={toggle}
      className={[
        "inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full p-[6px]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        aria-hidden="true"
        className={[
          "relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border border-border transition-colors",
          isDark ? "bg-accent" : "bg-surface-raised",
        ].join(" ")}
      >
        <span
          aria-hidden="true"
          className={[
            "inline-block h-6 w-6 transform rounded-full bg-surface shadow transition-transform",
            isDark ? "translate-x-7" : "translate-x-1",
          ].join(" ")}
        />
      </span>
    </button>
  );
}

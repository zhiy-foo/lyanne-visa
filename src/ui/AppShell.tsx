"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ThemeToggle } from "./ThemeToggle";

export type NavItem = { label: string; href: string; current?: boolean; badge?: number };

// The app icon + wordmark, shared by the top bar's menu button and the
// drawer header so the drawer reads as a continuation of the top bar.
function BrandMark() {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-ink"
      >
        L
      </span>
      <span className="truncate font-display text-[20px] font-semibold whitespace-nowrap text-text">
        Lyanne Visa
      </span>
    </span>
  );
}

export type AppShellProps = {
  user?: { name: string };
  nav: NavItem[];
  onSignOut(): void;
  children: ReactNode;
};

export function AppShell({ user, nav, onSignOut, children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!drawerOpen) return;

    const dialog = drawerRef.current;
    const focusable = () =>
      dialog?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ) ?? [];

    focusable()[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setDrawerOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = Array.from(focusable());
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  const initial = user?.name?.trim()?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
          className="flex min-h-[44px] min-w-0 items-center gap-2 rounded-lg py-1 pr-2 text-text hover:bg-surface-raised"
        >
          <BrandMark />
          <span aria-hidden="true" className="hidden text-muted sm:inline">
            ▾
          </span>
        </button>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-ink font-semibold"
              >
                {initial}
              </span>
              <span className="hidden text-[17px] font-semibold text-text sm:inline">
                {user.name}
              </span>
            </>
          ) : null}
          <button
            type="button"
            onClick={onSignOut}
            className="hidden min-h-[44px] items-center text-[17px] font-semibold text-accent underline underline-offset-2 sm:inline-flex"
          >
            Sign out
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* Stays mounted (rather than unmounting on close) so the closing
          transition can play out; `inert` removes the whole overlay from
          focus, hit-testing and assistive tech while closed. */}
      <div className="fixed inset-0 z-40 flex" inert={!drawerOpen}>
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setDrawerOpen(false)}
          className={[
            "absolute inset-0 bg-black/50 transition-opacity duration-200 ease-out motion-reduce:transition-none",
            drawerOpen ? "opacity-100" : "opacity-0",
          ].join(" ")}
        />
        <div
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          className={[
            "relative flex h-full w-72 max-w-[85vw] flex-col gap-2 border-r border-border bg-surface p-4",
            "transition-transform duration-200 ease-out motion-reduce:transition-none motion-reduce:duration-0",
            drawerOpen ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
        >
          <div className="mb-1 flex items-center gap-2 border-b border-border pb-3">
            <BrandMark />
          </div>
          <nav className="flex flex-1 flex-col gap-2">
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={[
                  "min-h-[48px] rounded-xl px-4 py-3 text-[17px] font-semibold flex items-center justify-between gap-2",
                  item.current
                    ? "bg-accent text-accent-ink"
                    : "border border-border text-text",
                ].join(" ")}
              >
                <span>{item.label}</span>
                {item.badge ? (
                  <span
                    aria-label={`${item.badge} waiting`}
                    className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-attention-bg px-1.5 text-[13px] font-bold text-attention"
                  >
                    {item.badge}
                  </span>
                ) : null}
              </a>
            ))}
          </nav>
          <button
            type="button"
            onClick={onSignOut}
            className="mb-1 inline-flex min-h-[44px] items-center self-start text-[17px] font-semibold text-accent underline underline-offset-2"
          >
            Sign out
          </button>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[960px] flex-1 px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}

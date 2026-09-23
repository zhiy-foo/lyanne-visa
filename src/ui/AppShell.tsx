"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ThemeToggle } from "./ThemeToggle";

export type NavItem = { label: string; href: string; current?: boolean };

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
          className="flex items-center gap-2 rounded-lg py-1 pr-2 text-text hover:bg-surface-raised"
        >
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-ink"
          >
            L
          </span>
          <span className="font-display text-[20px] font-semibold">Lyanne Visa</span>
          <span aria-hidden="true" className="text-muted">
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
            className="text-[17px] font-semibold text-accent underline underline-offset-2"
          >
            Sign out
          </button>
          <ThemeToggle />
        </div>
      </header>

      {drawerOpen ? (
        <div className="fixed inset-0 z-40 flex">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="relative flex h-full w-72 max-w-[85vw] flex-col gap-2 border-r border-border bg-surface p-4"
          >
            <nav className="flex flex-1 flex-col gap-2">
              {nav.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className={[
                    "min-h-[48px] rounded-xl px-4 py-3 text-[17px] font-semibold flex items-center",
                    item.current
                      ? "bg-accent text-accent-ink"
                      : "border border-border text-text",
                  ].join(" ")}
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <button
              type="button"
              onClick={onSignOut}
              className="mb-1 self-start text-[17px] font-semibold text-accent underline underline-offset-2"
            >
              Sign out
            </button>
          </div>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-[960px] flex-1 px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}

"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "quiet";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  busy?: boolean;
  busyLabel?: string;
  /** Destructive buttons are outlined by default; ConfirmDialog fills them. */
  filled?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl px-5 min-h-[48px] font-semibold text-[17px] transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-ink hover:brightness-95",
  secondary: "bg-transparent border border-border text-text hover:bg-surface-raised",
  danger: "bg-transparent border border-danger text-danger hover:bg-danger-bg",
  quiet: "bg-transparent text-text hover:bg-surface-raised",
};

const dangerFilled = "bg-danger border border-danger text-accent-ink hover:brightness-95";

export function Button({
  variant = "secondary",
  busy = false,
  busyLabel = "Working…",
  filled = false,
  fullWidth = false,
  className = "",
  disabled,
  children,
  ...rest
}: ButtonProps) {
  const variantClass =
    variant === "danger" && filled ? dangerFilled : variantClasses[variant];

  return (
    <button
      type="button"
      aria-busy={busy || undefined}
      disabled={disabled || busy}
      className={[
        base,
        variantClass,
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {busy ? busyLabel : children}
    </button>
  );
}

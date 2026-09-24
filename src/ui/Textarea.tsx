"use client";

import { useId } from "react";
import type { TextareaHTMLAttributes } from "react";

export type TextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "id" | "className"
> & {
  label: string;
  helperText?: string;
  errorText?: string;
  className?: string;
};

export function Textarea({
  label,
  helperText,
  errorText,
  rows = 3,
  className = "",
  ...rest
}: TextareaProps) {
  const id = useId();
  const helperId = helperText ? `${id}-helper` : undefined;
  const errorId = errorText ? `${id}-error` : undefined;

  return (
    <div className={["flex flex-col gap-1.5", className].join(" ")}>
      <label htmlFor={id} className="text-[15px] font-bold text-text">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        aria-describedby={[helperId, errorId].filter(Boolean).join(" ") || undefined}
        aria-invalid={errorText ? true : undefined}
        className="min-h-[88px] rounded-xl border border-border bg-surface-raised px-4 py-3 text-[17px] text-text placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        {...rest}
      />
      {helperText ? (
        <p id={helperId} className="text-[15px] text-muted">
          {helperText}
        </p>
      ) : null}
      {errorText ? (
        <p id={errorId} role="alert" className="text-[15px] font-semibold text-danger">
          {errorText}
        </p>
      ) : null}
    </div>
  );
}

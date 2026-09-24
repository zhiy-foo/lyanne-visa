"use client";

import { useId } from "react";

export type DateRangePickerProps = {
  startLabel?: string;
  endLabel?: string;
  /** ISO 'YYYY-MM-DD', or "" when unset. */
  start: string;
  end: string;
  onChangeStart(value: string): void;
  onChangeEnd(value: string): void;
  /** Earliest selectable date for both fields (e.g. today). The pick-up
   * field's own minimum is further raised to the chosen drop-off date. */
  min?: string;
  errorText?: string;
  className?: string;
};

// Native <input type="date"> — keyboard-operable and gives every device its
// own familiar date picker UI (per design-reference.md, "native date inputs
// are acceptable if styled to the design"); styled to match TextField/Select.
export function DateRangePicker({
  startLabel = "Drop-off",
  endLabel = "Pick-up",
  start,
  end,
  onChangeStart,
  onChangeEnd,
  min,
  errorText,
  className = "",
}: DateRangePickerProps) {
  const id = useId();
  const errorId = errorText ? `${id}-error` : undefined;
  const inputClasses =
    "min-h-[48px] rounded-xl border border-border bg-surface-raised px-4 text-[17px] text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";

  return (
    <div className={["flex flex-col gap-1.5", className].join(" ")}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor={`${id}-start`} className="text-[15px] font-bold text-text">
            {startLabel}
          </label>
          <input
            id={`${id}-start`}
            type="date"
            value={start}
            min={min}
            aria-describedby={errorId}
            aria-invalid={errorText ? true : undefined}
            onChange={(event) => onChangeStart(event.target.value)}
            className={inputClasses}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor={`${id}-end`} className="text-[15px] font-bold text-text">
            {endLabel}
          </label>
          <input
            id={`${id}-end`}
            type="date"
            value={end}
            min={start || min}
            aria-describedby={errorId}
            aria-invalid={errorText ? true : undefined}
            onChange={(event) => onChangeEnd(event.target.value)}
            className={inputClasses}
          />
        </div>
      </div>
      {errorText ? (
        <p id={errorId} role="alert" className="text-[15px] font-semibold text-danger">
          {errorText}
        </p>
      ) : null}
    </div>
  );
}

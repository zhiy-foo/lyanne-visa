"use client";

import { useId } from "react";

export type SelectOption = { value: string; label: string };

export type SelectProps = {
  label: string;
  value: string;
  onChange(value: string): void;
  options: SelectOption[];
  placeholder?: string;
  helperText?: string;
  errorText?: string;
  /** Renders a text input backed by a <datalist> so the list can be typed/filtered. */
  searchable?: boolean;
  disabled?: boolean;
  className?: string;
};

export function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
  helperText,
  errorText,
  searchable = false,
  disabled = false,
  className = "",
}: SelectProps) {
  const id = useId();
  const listId = `${id}-list`;
  const helperId = helperText ? `${id}-helper` : undefined;
  const errorId = errorText ? `${id}-error` : undefined;
  const describedBy = [helperId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={["flex flex-col gap-1.5", className].join(" ")}>
      <label htmlFor={id} className="text-[15px] font-bold text-text">
        {label}
      </label>
      {searchable ? (
        <>
          <input
            id={id}
            list={listId}
            value={value}
            disabled={disabled}
            placeholder={placeholder}
            aria-describedby={describedBy}
            aria-invalid={errorText ? true : undefined}
            onChange={(event) => onChange(event.target.value)}
            className="min-h-[48px] rounded-xl border border-border bg-surface-raised px-4 text-[17px] text-text placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          />
          <datalist id={listId}>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </datalist>
        </>
      ) : (
        <select
          id={id}
          value={value}
          disabled={disabled}
          aria-describedby={describedBy}
          aria-invalid={errorText ? true : undefined}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-[48px] rounded-xl border border-border bg-surface-raised px-4 text-[17px] text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
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

import type { HTMLAttributes, ReactNode } from "react";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** Adds a thin accent + guilloche "letterhead" band across the top edge
   * of the card, like the printed rule at the top of an official document.
   * Purely decorative (`aria-hidden`, absolutely positioned so it never
   * affects the card's own flex/gap layout) and never sits behind text —
   * it lives in the card's own top padding, above the content. Used
   * sparingly, on a screen's single lead card rather than every card, and
   * only on cards that don't hold anything (e.g. an InfoTip's popover)
   * that relies on overflowing the card's edge — `letterhead` clips to the
   * card's rounded corners, so it should stay off cards with content that
   * needs to escape them. */
  letterhead?: boolean;
  children: ReactNode;
};

export function Card({ letterhead = false, children, className = "", ...rest }: CardProps) {
  return (
    <div
      className={[
        "relative rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5",
        letterhead ? "overflow-hidden" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {letterhead ? (
        <span aria-hidden="true" className="bg-guilloche absolute inset-x-0 top-0 h-2 bg-accent" />
      ) : null}
      {children}
    </div>
  );
}

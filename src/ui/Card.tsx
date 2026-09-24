import type { HTMLAttributes, ReactNode } from "react";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function Card({ children, className = "", ...rest }: CardProps) {
  return (
    <div
      className={[
        "rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}

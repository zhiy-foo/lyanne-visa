import type { ReactNode } from "react";

export type BannerVariant = "attention" | "neutral";

export type BannerProps = {
  variant?: BannerVariant;
  title: string;
  children?: ReactNode;
  className?: string;
};

export function Banner({
  variant = "attention",
  title,
  children,
  className = "",
}: BannerProps) {
  const toneClasses =
    variant === "attention"
      ? "bg-attention-bg border-l-4 border-l-attention"
      : "bg-surface-raised border-l-4 border-l-border";

  return (
    <div
      role={variant === "attention" ? "status" : undefined}
      className={["rounded-2xl p-4 sm:p-5", toneClasses, className]
        .filter(Boolean)
        .join(" ")}
    >
      <p className="font-display text-[20px] font-semibold text-text">{title}</p>
      {children ? <div className="mt-1 text-[17px] text-text">{children}</div> : null}
    </div>
  );
}

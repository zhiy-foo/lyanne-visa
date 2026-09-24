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
  const toneClasses = variant === "attention" ? "bg-attention-bg" : "bg-surface-raised";

  return (
    <div
      role={variant === "attention" ? "status" : undefined}
      className={["relative overflow-hidden rounded-2xl", toneClasses, className]
        .filter(Boolean)
        .join(" ")}
    >
      {/* The guilloche wash lives only in this spine, never behind the copy
          next to it — textures must never risk reducing text contrast. */}
      <span
        aria-hidden="true"
        className={[
          "absolute inset-y-0 left-0 w-2.5",
          variant === "attention" ? "bg-guilloche bg-attention" : "bg-border",
        ].join(" ")}
      />
      <div className="p-4 pl-6 sm:p-5 sm:pl-7">
        <p className="font-display text-[20px] font-semibold text-text">{title}</p>
        {children ? <div className="mt-1 text-[17px] text-text">{children}</div> : null}
      </div>
    </div>
  );
}

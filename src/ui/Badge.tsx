export type BadgeVariant = "attention" | "confirmed" | "neutral" | "danger";

export type BadgeProps = {
  variant?: BadgeVariant;
  icon: string;
  label: string;
  className?: string;
};

const toneClasses: Record<BadgeVariant, string> = {
  attention: "bg-attention-bg text-attention",
  confirmed: "bg-confirmed-bg text-confirmed",
  neutral: "bg-surface-raised text-muted",
  danger: "bg-danger-bg text-danger",
};

// Status is always shown with an icon + word, never colour alone.
export function Badge({ variant = "neutral", icon, label, className = "" }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full py-1 pl-1.5 pr-3 text-[15px] font-semibold",
        toneClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        aria-hidden="true"
        className="flex h-5 w-5 items-center justify-center rounded-full bg-black/10 text-[13px]"
      >
        {icon}
      </span>
      {label}
    </span>
  );
}

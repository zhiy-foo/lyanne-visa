export type ChipVariant = "danger" | "attention" | "neutral";

export type ChipProps = {
  variant?: ChipVariant;
  label: string;
  className?: string;
};

const toneClasses: Record<ChipVariant, string> = {
  danger: "bg-danger-bg text-danger",
  attention: "bg-attention-bg text-attention",
  neutral: "bg-surface-raised text-text",
};

export function Chip({ variant = "neutral", label, className = "" }: ChipProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-md px-2.5 py-1 text-[15px] font-bold",
        toneClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {label}
    </span>
  );
}

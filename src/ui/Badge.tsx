export type BadgeVariant = "attention" | "confirmed" | "neutral" | "danger";

export type BadgeProps = {
  variant?: BadgeVariant;
  icon: string;
  label: string;
  /** The single "just stamped" emphasis: a slight ink-stamp rotation and a
   * heavier ring for confirmed/attention badges, like a stamp pressed
   * slightly off true. Reserved for a screen's one lead status (Overview's
   * Event brief, ApplicationDetail's header) — list rows (Applications,
   * AdminAccounts, ...) keep the plain, unrotated stamp so repeated badges
   * stay tidy and aligned. No effect on neutral/danger badges. */
  stamped?: boolean;
  className?: string;
};

// "Stamp" treatment: confirmed reads as an approved ink stamp (a solid
// double ring, like a passport's entry stamp); attention reads as a
// pending stamp (a dashed outline, not yet inked in). Status is always
// shown with an icon + word, never colour alone.
const toneClasses: Record<BadgeVariant, string> = {
  attention: "border border-dashed border-attention bg-attention-bg text-attention",
  confirmed: "border-2 border-double border-confirmed bg-confirmed-bg text-confirmed",
  neutral: "border border-border bg-surface-raised text-muted",
  danger: "border border-danger bg-danger-bg text-danger",
};

const stampedToneClasses: Partial<Record<BadgeVariant, string>> = {
  attention: "-rotate-2 shadow-sm",
  confirmed: "-rotate-3 border-[3px] shadow-sm",
};

export function Badge({ variant = "neutral", icon, label, stamped = false, className = "" }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full py-1 pl-1.5 pr-3 text-[15px] font-semibold",
        toneClasses[variant],
        stamped ? (stampedToneClasses[variant] ?? "") : "",
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

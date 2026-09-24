import type { DateRange } from "./types";
import { formatDayMonth } from "./format";

export type VisaDatesProps = {
  dates: DateRange;
  /** `attention` tints both the captions and the dates for a pending
   * change (matches the amber "not agreed yet" language used elsewhere);
   * `text` (default) is the calm, agreed-dates reading. */
  tone?: "text" | "attention";
  className?: string;
};

// The "visa entry" treatment: a stay's two dates set like a passport's
// entry/exit stamp fields rather than one flat range string. Shared between
// Overview's Event brief and ApplicationDetail so both read the same way.
export function VisaDates({ dates, tone = "text", className = "" }: VisaDatesProps) {
  const toneClass = tone === "attention" ? "text-attention" : "text-text";

  return (
    <div className={["flex items-stretch gap-3", className].join(" ")}>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold tracking-[0.14em] text-muted uppercase">Entry</p>
        <p className={`font-display text-[22px] font-semibold tracking-wide ${toneClass}`}>
          {formatDayMonth(dates.start)}
        </p>
      </div>
      <span aria-hidden="true" className="flex items-center pt-4 text-muted">
        →
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold tracking-[0.14em] text-muted uppercase">Exit</p>
        <p className={`font-display text-[22px] font-semibold tracking-wide ${toneClass}`}>
          {formatDayMonth(dates.end)}
        </p>
      </div>
    </div>
  );
}

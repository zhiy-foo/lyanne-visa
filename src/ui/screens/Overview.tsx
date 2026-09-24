"use client";

import { useMemo, useState } from "react";
import type { OverviewProps } from "../types";
import { Card } from "../Card";
import { Banner } from "../Banner";
import { Badge } from "../Badge";
import { Button } from "../Button";
import { VisaDates } from "../VisaDates";
import {
  addMonths,
  buildMonthGrid,
  dayState,
  monthLabel,
  pickFeaturedStay,
  WEEKDAY_LABELS,
  type YearMonth,
} from "../calendar";
import { formatDayMonth, formatNights, nights, todayISO } from "../format";
import { needsViewerAnswer, statusInfo } from "../stayStatus";

function yearMonthOf(iso: string): YearMonth {
  const [year, month] = iso.split("-").map(Number);
  return { year, month };
}

export function Overview({ name, stays, today, onOpen }: OverviewProps) {
  const pinnedToday = today ?? todayISO();

  const needsAnswer = useMemo(
    () => stays.filter((stay) => needsViewerAnswer(stay)),
    [stays],
  );
  const featured = useMemo(
    () => pickFeaturedStay(stays, pinnedToday),
    [stays, pinnedToday],
  );

  const [month, setMonth] = useState<YearMonth>(() =>
    yearMonthOf(featured?.dates.start ?? pinnedToday),
  );

  const calendarStays = useMemo(
    () =>
      stays
        .filter((stay) => stay.phase === "confirmed" || stay.phase === "negotiating")
        .map((stay) => ({ id: stay.id, dates: stay.dates, agreed: stay.phase === "confirmed" })),
    [stays],
  );

  const grid = buildMonthGrid(month);

  return (
    <div className="flex flex-col gap-5">
      <p className="font-display text-[32px] font-semibold text-text">Hi {name}</p>

      {needsAnswer.length > 0 ? (
        <Banner
          variant="attention"
          title={`${needsAnswer.length} stay${needsAnswer.length === 1 ? "" : "s"} needs your answer`}
        >
          Tap the dashed dates on the calendar, or open Applications.
        </Banner>
      ) : null}

      <Card>
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setMonth((current) => addMonths(current, -1))}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <span aria-hidden="true">‹</span>
          </button>
          <p className="font-display text-[20px] font-semibold text-text sm:text-[24px]">
            {monthLabel(month)}
          </p>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setMonth((current) => addMonths(current, 1))}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>

        {/* -mx-4/px-2 (sm:-mx-5/px-3) reclaims most of the card's own
            padding for just the calendar grid: at 390px wide, 7 columns of
            the required 44px touch target plus gaps don't fit inside the
            card's full padding, so the grid runs closer to the card's edge
            than the rest of the card's content. */}
        <div className="-mx-4 px-2 sm:-mx-5 sm:px-3">
          <div className="mt-4 grid grid-cols-7 gap-1 text-center font-display text-[15px] font-semibold text-muted">
            {WEEKDAY_LABELS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {grid.map((cell, index) => {
              if (!cell) return <span key={`blank-${index}`} aria-hidden="true" className="h-11" />;

              const state = dayState(cell.date, calendarStays, featured?.id);
              const dayNumber = Number(cell.date.slice(-2));

              if (!state) {
                return (
                  <span
                    key={cell.date}
                    className="flex h-11 items-center justify-center font-display text-[15px] tabular-nums text-text"
                  >
                    {dayNumber}
                  </span>
                );
              }

              return (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => onOpen(state.stayId)}
                  aria-label={`${formatDayMonth(cell.date)} · ${state.agreed ? "Confirmed" : "Not agreed yet"}${
                    state.selected ? " · selected stay" : ""
                  }`}
                  className={[
                    "flex h-11 flex-col items-center justify-center rounded-lg font-display text-[15px] leading-tight font-semibold tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
                    state.agreed
                      ? "bg-confirmed-bg text-confirmed"
                      : "border border-dashed border-attention bg-transparent text-attention",
                    state.selected ? "ring-2 ring-accent" : "",
                  ].join(" ")}
                >
                  <span>{dayNumber}</span>
                  <span aria-hidden="true" className="text-[13px]">
                    {state.agreed ? "✓" : "?"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-[15px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="flex h-5 w-5 items-center justify-center rounded bg-confirmed-bg text-confirmed"
            >
              ✓
            </span>
            Confirmed
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="flex h-5 w-5 items-center justify-center rounded border border-dashed border-attention text-attention"
            >
              ?
            </span>
            Not agreed yet
          </span>
        </div>
      </Card>

      {featured ? (
        <Card letterhead>
          <p className="font-display text-[24px] font-semibold text-text">Event brief</p>
          <Badge className="mt-3" stamped {...statusInfo(featured)} />
          <VisaDates dates={featured.dates} className="mt-4" />
          <p className="mt-2 text-[15px] text-muted">
            {formatNights(nights(featured.dates))} · {featured.childName} at {featured.placeName}
          </p>
          {featured.latestMove ? (
            <Banner variant="attention" title={featured.latestMove.summary} className="mt-3">
              {featured.latestMove.note}
            </Banner>
          ) : null}
          <Button variant="primary" fullWidth className="mt-4" onClick={() => onOpen(featured.id)}>
            {needsViewerAnswer(featured) ? "Answer this request" : "View stay"}
          </Button>
        </Card>
      ) : null}
    </div>
  );
}

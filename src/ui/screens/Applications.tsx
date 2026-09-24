"use client";

import type { ApplicationsProps, StaySummary } from "../types";
import { Card } from "../Card";
import { Badge } from "../Badge";
import { Button } from "../Button";
import { formatDateRange, formatNights, nights, todayISO } from "../format";
import { categorizeStay, statusInfo } from "../stayStatus";

function StayRow({ stay, onOpen }: { stay: StaySummary; onOpen(id: string): void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(stay.id)}
      className="flex min-h-[64px] w-full flex-col items-start gap-1 rounded-xl border border-border bg-surface px-4 py-3 text-left hover:bg-surface-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    >
      <div className="flex w-full flex-wrap items-center justify-between gap-2">
        <p className="text-[17px] font-bold text-text">
          {stay.childName} <span className="font-normal text-muted">at {stay.placeName}</span>
        </p>
        <Badge {...statusInfo(stay)} />
      </div>
      <p className="text-[15px] text-muted">
        {formatDateRange(stay.dates)} · {formatNights(nights(stay.dates))}
      </p>
    </button>
  );
}

function Group({
  title,
  stays,
  onOpen,
}: {
  title: string;
  stays: StaySummary[];
  onOpen(id: string): void;
}) {
  if (stays.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[16px] font-bold text-text">{title}</p>
      <div className="flex flex-col gap-2">
        {stays.map((stay) => (
          <StayRow key={stay.id} stay={stay} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

export function Applications({ stays, canCreate, today, onOpen, onNew }: ApplicationsProps) {
  const pinnedToday = today ?? todayISO();

  if (stays.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <p className="font-display text-[32px] font-semibold text-text">Applications</p>
        <Card className="text-center">
          <p className="font-display text-[24px] font-semibold text-text">
            {canCreate ? "Plan your first stay" : "Nothing to answer yet"}
          </p>
          <p className="mt-2 text-[17px] text-muted">
            {canCreate
              ? "Ask for a stay and we'll let you know as soon as it's confirmed."
              : "You'll see applications here once a parent asks for a stay."}
          </p>
          {canCreate ? (
            <Button variant="primary" className="mt-4" onClick={onNew}>
              Plan a stay
            </Button>
          ) : null}
        </Card>
      </div>
    );
  }

  const needsAnswer = stays.filter((stay) => categorizeStay(stay, pinnedToday) === "needs-answer");
  const upcoming = stays.filter((stay) => categorizeStay(stay, pinnedToday) === "upcoming");
  const past = stays.filter((stay) => categorizeStay(stay, pinnedToday) === "past");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-display text-[32px] font-semibold text-text">Applications</p>
        {canCreate ? (
          <Button variant="primary" onClick={onNew}>
            Plan a stay
          </Button>
        ) : null}
      </div>

      <Group title="Needs your answer" stays={needsAnswer} onOpen={onOpen} />
      <Group title="Upcoming" stays={upcoming} onOpen={onOpen} />
      <Group title="Past & closed" stays={past} onOpen={onOpen} />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import type { PlanStayProps } from "../types";
import { Card } from "../Card";
import { Banner } from "../Banner";
import { Button } from "../Button";
import { Select } from "../Select";
import { Textarea } from "../Textarea";
import { DateRangePicker } from "../DateRangePicker";
import { isValidDateRange } from "../format";

export function PlanStay({ children, places, capacityWarning, onPlaceOrDatesChange, onSubmit, onCancel }: PlanStayProps) {
  const [childId, setChildId] = useState(children.length === 1 ? children[0].id : "");
  const [placeId, setPlaceId] = useState(places.length === 1 ? places[0].id : "");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const dates = { start, end };
  const rangeComplete = Boolean(start && end);
  const rangeValid = rangeComplete && isValidDateRange(dates);
  const warning = rangeValid && placeId && capacityWarning ? capacityWarning(placeId, dates) : undefined;
  const canSubmit = Boolean(childId && placeId && rangeValid) && !busy;

  useEffect(() => {
    if (rangeValid && placeId && onPlaceOrDatesChange) {
      onPlaceOrDatesChange(placeId, { start, end });
    }
  }, [rangeValid, placeId, start, end, onPlaceOrDatesChange]);

  async function submit() {
    if (!childId) {
      setError("Choose a child.");
      return;
    }
    if (!placeId) {
      setError("Choose a home.");
      return;
    }
    if (!rangeComplete) {
      setError("Choose drop-off and pick-up dates.");
      return;
    }
    if (!rangeValid) {
      setError("The pick-up day must be after the drop-off day.");
      return;
    }

    setBusy(true);
    setError(undefined);
    const result = await onSubmit({ childId, placeId, dates, note: note.trim() || undefined });
    setBusy(false);
    if (!result.ok) setError(result.message);
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="font-display text-[32px] font-semibold text-text">Plan a stay</p>

      <Card className="flex flex-col gap-4">
        <Select
          label="Child"
          value={childId}
          onChange={setChildId}
          placeholder="Choose a child"
          options={children.map((child) => ({ value: child.id, label: child.name }))}
        />
        <Select
          label="Home"
          value={placeId}
          onChange={setPlaceId}
          placeholder="Choose a home"
          options={places.map((place) => ({ value: place.id, label: place.name }))}
        />
        <DateRangePicker start={start} end={end} onChangeStart={setStart} onChangeEnd={setEnd} />

        {warning ? (
          <Banner variant="attention" title="This home may already be full">
            {warning}
          </Banner>
        ) : null}

        <Textarea
          label="Note (optional)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Anything the hosts should know about these dates"
        />

        {error ? (
          <p role="alert" className="text-[15px] font-semibold text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" busy={busy} disabled={!canSubmit} onClick={submit}>
            Send request
          </Button>
        </div>
      </Card>
    </div>
  );
}

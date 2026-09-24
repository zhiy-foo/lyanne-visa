"use client";

import { useState } from "react";
import type { ApplicationDetailProps } from "../types";
import { Card } from "../Card";
import { Banner } from "../Banner";
import { Button } from "../Button";
import { ConfirmDialog } from "../ConfirmDialog";
import { Textarea } from "../Textarea";
import { DateRangePicker } from "../DateRangePicker";
import { formatDateRange, formatNights, isValidDateRange, nights } from "../format";
import { describeMove, statusBanner } from "../stayStatus";

type PendingAction = "decline" | "cancel" | "delete" | null;

export function ApplicationDetail({
  childName,
  placeName,
  viewerSide,
  phase,
  awaiting,
  agreed,
  proposed,
  history,
  can,
  onAccept,
  onDecline,
  onPropose,
  onCancel,
  onDelete,
}: ApplicationDetailProps) {
  const [acceptBusy, setAcceptBusy] = useState(false);
  const [acceptError, setAcceptError] = useState<string | undefined>(undefined);

  const [pending, setPending] = useState<PendingAction>(null);
  const [note, setNote] = useState("");
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | undefined>(undefined);

  const [suggesting, setSuggesting] = useState(false);
  const [suggestStart, setSuggestStart] = useState("");
  const [suggestEnd, setSuggestEnd] = useState("");
  const [suggestNote, setSuggestNote] = useState("");
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [suggestError, setSuggestError] = useState<string | undefined>(undefined);

  const banner = statusBanner({ phase, awaiting, viewerSide, placeName, childName });
  const hasActions = can.accept || can.decline || can.propose || can.cancel || can.delete;

  async function accept() {
    setAcceptBusy(true);
    setAcceptError(undefined);
    const result = await onAccept();
    setAcceptBusy(false);
    if (!result.ok) setAcceptError(result.message);
  }

  function openConfirm(action: PendingAction) {
    setPending(action);
    setNote("");
    setConfirmError(undefined);
  }

  async function confirmPending() {
    if (!pending) return;
    setConfirmBusy(true);
    setConfirmError(undefined);
    const trimmedNote = note.trim() || undefined;
    const result =
      pending === "decline"
        ? await onDecline(trimmedNote)
        : pending === "cancel"
          ? await onCancel(trimmedNote)
          : await onDelete();
    setConfirmBusy(false);
    if (result.ok) {
      setPending(null);
    } else {
      setConfirmError(result.message);
    }
  }

  async function submitSuggestion() {
    const dates = { start: suggestStart, end: suggestEnd };
    if (!suggestStart || !suggestEnd) {
      setSuggestError("Choose drop-off and pick-up dates.");
      return;
    }
    if (!isValidDateRange(dates)) {
      setSuggestError("The pick-up day must be after the drop-off day.");
      return;
    }
    setSuggestBusy(true);
    setSuggestError(undefined);
    const result = await onPropose(dates, suggestNote.trim() || undefined);
    setSuggestBusy(false);
    if (result.ok) {
      setSuggesting(false);
      setSuggestStart("");
      setSuggestEnd("");
      setSuggestNote("");
    } else {
      setSuggestError(result.message);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="font-display text-[32px] font-semibold text-text">
        {childName} at {placeName}
      </p>

      <Banner variant={banner.variant} title={banner.title}>
        {banner.body}
      </Banner>

      <Card className="flex flex-col gap-3">
        {agreed ? (
          <div>
            <p className="text-[15px] font-bold text-text">Agreed dates</p>
            <p className="font-display text-[24px] font-semibold text-text">{formatDateRange(agreed)}</p>
            <p className="text-[15px] text-muted">{formatNights(nights(agreed))}</p>
          </div>
        ) : null}
        {proposed ? (
          <div className={agreed ? "border-t border-border pt-3" : ""}>
            <p className="text-[15px] font-bold text-attention">
              {agreed ? "Proposed change" : "Proposed dates"}
            </p>
            <p className="font-display text-[24px] font-semibold text-text">{formatDateRange(proposed)}</p>
            <p className="text-[15px] text-muted">{formatNights(nights(proposed))}</p>
          </div>
        ) : null}
        {!agreed && !proposed ? <p className="text-[17px] text-muted">No dates on this application.</p> : null}
      </Card>

      {hasActions ? (
        <Card className="flex flex-col gap-3">
          <p className="text-[16px] font-bold text-text">What would you like to do?</p>
          <div className="flex flex-wrap gap-2">
            {can.accept ? (
              <Button variant="primary" busy={acceptBusy} onClick={accept}>
                Accept
              </Button>
            ) : null}
            {can.propose ? (
              <Button variant="secondary" onClick={() => setSuggesting((open) => !open)}>
                Suggest other dates
              </Button>
            ) : null}
            {can.decline ? (
              <Button variant="danger" onClick={() => openConfirm("decline")}>
                Decline
              </Button>
            ) : null}
            {can.cancel ? (
              <Button variant="danger" onClick={() => openConfirm("cancel")}>
                Cancel stay
              </Button>
            ) : null}
            {can.delete ? (
              <Button variant="danger" onClick={() => openConfirm("delete")}>
                Delete
              </Button>
            ) : null}
          </div>
          {acceptError ? (
            <p role="alert" className="text-[15px] font-semibold text-danger">
              {acceptError}
            </p>
          ) : null}

          {suggesting ? (
            <div className="mt-2 flex flex-col gap-3 border-t border-border pt-3">
              <DateRangePicker
                start={suggestStart}
                end={suggestEnd}
                onChangeStart={setSuggestStart}
                onChangeEnd={setSuggestEnd}
              />
              <Textarea
                label="Note (optional)"
                value={suggestNote}
                onChange={(event) => setSuggestNote(event.target.value)}
              />
              {suggestError ? (
                <p role="alert" className="text-[15px] font-semibold text-danger">
                  {suggestError}
                </p>
              ) : null}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="secondary" onClick={() => setSuggesting(false)} disabled={suggestBusy}>
                  Cancel
                </Button>
                <Button variant="primary" busy={suggestBusy} onClick={submitSuggestion}>
                  Send
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <p className="text-[16px] font-bold text-text">History</p>
        {history.length === 0 ? (
          <p className="mt-2 text-[17px] text-muted">No activity yet.</p>
        ) : (
          <ol className="mt-3 flex flex-col gap-3">
            {history.map((move, index) => (
              <li key={`${move.at}-${index}`} className="border-l-2 border-border pl-3">
                <p className="text-[17px] text-text">{describeMove(move, index === 0)}</p>
                <p className="text-[13px] text-muted">{new Date(move.at).toLocaleString()}</p>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <ConfirmDialog
        open={pending !== null}
        title={
          pending === "decline"
            ? "Decline this application?"
            : pending === "cancel"
              ? "Cancel this stay?"
              : "Delete this application?"
        }
        description={
          pending === "delete"
            ? "This removes it and its history for good."
            : "You can add a note to explain why, if you'd like."
        }
        confirmLabel={pending === "delete" ? "Delete" : pending === "cancel" ? "Cancel stay" : "Decline"}
        danger
        busy={confirmBusy}
        errorText={confirmError}
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      >
        {pending !== "delete" ? (
          <Textarea label="Note (optional)" value={note} onChange={(event) => setNote(event.target.value)} />
        ) : null}
      </ConfirmDialog>
    </div>
  );
}

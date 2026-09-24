// Pure presentational formatters shared across src/ui screens.

/** Formats a whole number of seconds as m:ss for a countdown label, e.g.
 * formatCountdown(45) -> "0:45", formatCountdown(60) -> "1:00",
 * formatCountdown(0) -> "0:00". Negative input is clamped to 0. */
export function formatCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

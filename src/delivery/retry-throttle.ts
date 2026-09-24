// createRetryThrottle (task 4.4; design.md Decision b step 3): "at most once
// per window per instance". Pure and clock-injectable so it's unit-testable
// without a real clock or a real request; src/proxy.ts holds one
// module-level instance (created once per running server instance, which is
// exactly what "per instance" means here — a fresh instance on cold start,
// shared across every request that instance serves after that).

export interface RetryThrottleOptions {
  /** Minimum time between two `shouldRun()` calls returning true. Default 60s. */
  windowMs?: number;
  /** Injectable clock for deterministic tests. Defaults to `Date.now`. */
  now?: () => number;
}

export interface RetryThrottle {
  /** True at most once per `windowMs`; every other call in that window returns false. */
  shouldRun(): boolean;
}

export function createRetryThrottle(options: RetryThrottleOptions = {}): RetryThrottle {
  const windowMs = options.windowMs ?? 60_000;
  const now = options.now ?? (() => Date.now());
  let lastRunAt: number | null = null;

  return {
    shouldRun(): boolean {
      const t = now();
      if (lastRunAt !== null && t - lastRunAt < windowMs) {
        return false;
      }
      lastRunAt = t;
      return true;
    },
  };
}

// How long to wait before trying an upload part again — the twin of
// android's `UploadRetry.kt`, deliberately the same numbers.
//
// **Why the client retries at all.** A part is the unit of failure on the
// resumable path, so a connection that blinks costs one part rather than a
// hundred mebibytes; retrying that part automatically is what turns the blip
// into something the author never has to see. Web previously had no automatic
// retry anywhere (CROSS-14), which combined with no resumability (CROSS-03)
// made the browser the worst of the two clients on exactly the upload most
// likely to fail.
//
// **Exponential backoff with jitter is the documented shape.** MDN's own
// guidance for repeating a failed fetch is to back off rather than hammer, and
// the jitter exists so that many clients recovering from one outage do not
// re-converge on the same instant. Android reached the same schedule from
// WorkManager's documented defaults; the two are kept identical on purpose so
// the product behaves the same on both surfaces.
//
// **Equal jitter rather than full.** Half the computed delay is always waited
// and half is randomised: full jitter can collapse to nearly zero, which
// re-sends a part into a network that is still down and spends an attempt for
// nothing.

/**
 * How many times one part may be sent before the upload gives up.
 *
 * Six attempts spend between 15 and 31 seconds waiting, which is chosen to
 * outlast the thing this exists for: a handover, a lift, or Wi-Fi dropping and
 * coming back. Anything longer is not a blip, and the author would rather be
 * told than watch a frozen bar.
 */
export const MAX_ATTEMPTS = 6;

/** The first wait, doubling from there. */
export const BASE_DELAY_MS = 1_000;

/** Where the doubling stops. */
export const MAX_DELAY_MS = 16_000;

/**
 * The wait before `attempt`, which is 1-based — the first try does not wait at
 * all.
 *
 * `jitter` is a 0..1 roll, taken by the caller so this stays a function of its
 * arguments and the schedule can be pinned in a test.
 */
export function delayMs(attempt: number, jitter: number): number {
  if (attempt <= 1) return 0;
  let backoff = BASE_DELAY_MS;
  for (let i = 0; i < attempt - 2; i += 1) {
    if (backoff < MAX_DELAY_MS) backoff *= 2;
  }
  const capped = Math.min(backoff, MAX_DELAY_MS);
  const half = Math.floor(capped / 2);
  const roll = Math.min(1, Math.max(0, jitter));
  return half + Math.floor(roll * half);
}

/** Whether another attempt is allowed after `attempt` just failed. */
export function retryable(attempt: number): boolean {
  return attempt < MAX_ATTEMPTS;
}

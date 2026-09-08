import { describe, expect, it } from "vitest";

import { BASE_DELAY_MS, MAX_ATTEMPTS, MAX_DELAY_MS, delayMs, retryable } from "./upload-retry";

// The schedule is pinned rather than described: it is the half of this
// feature that a person cannot see going wrong, and it is the half that must
// stay identical to android's `UploadRetryTest`.
describe("delayMs", () => {
  it("does not wait before the first attempt", () => {
    expect(delayMs(1, 0)).toBe(0);
    expect(delayMs(1, 1)).toBe(0);
    expect(delayMs(0, 0.5)).toBe(0);
  });

  it("doubles from the base delay and stops at the cap", () => {
    // The floor of each window is half the (capped) backoff.
    expect(delayMs(2, 0)).toBe(500);
    expect(delayMs(3, 0)).toBe(1_000);
    expect(delayMs(4, 0)).toBe(2_000);
    expect(delayMs(5, 0)).toBe(4_000);
    expect(delayMs(6, 0)).toBe(8_000);
    // Past the cap the window stops growing.
    expect(delayMs(7, 0)).toBe(8_000);
    expect(delayMs(9, 1)).toBe(MAX_DELAY_MS);
  });

  it("waits half the backoff always and the other half by the roll", () => {
    expect(delayMs(2, 1)).toBe(BASE_DELAY_MS);
    expect(delayMs(2, 0.5)).toBe(750);
    expect(delayMs(6, 1)).toBe(MAX_DELAY_MS);
    expect(delayMs(6, 0.5)).toBe(12_000);
  });

  it("clamps a roll outside 0..1 rather than trusting it", () => {
    expect(delayMs(3, -5)).toBe(delayMs(3, 0));
    expect(delayMs(3, 5)).toBe(delayMs(3, 1));
  });

  it("spends between 15 and 31 seconds across a whole budget", () => {
    const waits = (jitter: number) =>
      Array.from({ length: MAX_ATTEMPTS }, (_, i) => delayMs(i + 1, jitter)).reduce(
        (a, b) => a + b,
        0,
      );
    expect(waits(0)).toBe(15_500);
    expect(waits(1)).toBe(31_000);
  });
});

describe("retryable", () => {
  it("allows attempts up to the budget and no further", () => {
    expect(retryable(1)).toBe(true);
    expect(retryable(MAX_ATTEMPTS - 1)).toBe(true);
    expect(retryable(MAX_ATTEMPTS)).toBe(false);
    expect(retryable(MAX_ATTEMPTS + 1)).toBe(false);
  });
});

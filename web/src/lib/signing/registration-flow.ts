// The app-scoped, onboarding-only poll/sign loop that advances an
// application (web.md "The onboarding poll loop"; Android mirror:
// RegistrationFlow).

import type { RegistrationProgress, RegistrationSigner } from "./registration-signer";

/** The wait is on the server (landing) or on this device (a retry). */
const FAST_DELAY_MS = 3_000;
/** The wait is on a human: verification, approval, a fresh invite. */
const SLOW_DELAY_MS = 30_000;

export type RegistrationFlow = {
  /** Null until the first pass reports. */
  progress(): RegistrationProgress | null;
  subscribe(listener: () => void): () => void;
  /**
   * Starts the loop, or pokes a running one into an immediate pass —
   * never a second loop. Call whenever a proof just changed server-side:
   * poll now, not at the next slow-cadence tick.
   */
  ensureAdvancing(): void;
  /**
   * One-shot: true exactly once, for a landing this loop watched live.
   * A cold open as member greets nobody.
   */
  consumeLanded(): boolean;
  /**
   * Sign-out teardown: halts the loop, discards any in-flight pass's
   * report, and clears the progress. The next ensureAdvancing() starts
   * a fresh loop for the next session.
   */
  reset(): void;
};

export function createRegistrationFlow(deps: {
  signer: RegistrationSigner;
  fastDelayMs?: number;
  slowDelayMs?: number;
}): RegistrationFlow {
  const { signer } = deps;
  const fastDelayMs = deps.fastDelayMs ?? FAST_DELAY_MS;
  const slowDelayMs = deps.slowDelayMs ?? SLOW_DELAY_MS;

  let current: RegistrationProgress | null = null;
  const listeners = new Set<() => void>();
  // Each reset() bumps the epoch; a loop belongs to the epoch it started
  // in and exits silently the moment the epochs diverge.
  let epoch = 0;
  let loopEpoch = -1;
  let landed = false;
  let pokePending = false;
  let wake: (() => void) | null = null;

  function notify(): void {
    for (const l of listeners) l();
  }

  function setProgress(p: RegistrationProgress | null): void {
    current = p;
    notify();
  }

  function delayFor(p: RegistrationProgress): number {
    return p.kind === "awaitingLanding" || p.kind === "failed" ? fastDelayMs : slowDelayMs;
  }

  /** The delay leg — a poke (conflated) cuts it short. */
  function interruptibleDelay(ms: number): Promise<void> {
    if (pokePending) {
      pokePending = false;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        wake = null;
        resolve();
      }, ms);
      wake = () => {
        clearTimeout(timer);
        wake = null;
        pokePending = false;
        resolve();
      };
    });
  }

  async function loop(myEpoch: number): Promise<void> {
    let wasApplicant = false;
    for (;;) {
      // A throw out of a pass is a transport-shaped surprise: report it
      // as failed and keep polling rather than dying silently.
      const progress = await signer
        .advance()
        .catch((cause: unknown): RegistrationProgress => ({ kind: "failed", cause }));
      if (epoch !== myEpoch) return;
      setProgress(progress);
      if (progress.kind === "member") {
        if (wasApplicant) landed = true;
        break;
      }
      if (progress.kind === "rejectedByDevice") break;
      wasApplicant = true;
      await interruptibleDelay(delayFor(progress));
      if (epoch !== myEpoch) return;
    }
    loopEpoch = -1;
  }

  return {
    progress: () => current,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    ensureAdvancing() {
      if (loopEpoch === epoch) {
        pokePending = true;
        wake?.();
        return;
      }
      loopEpoch = epoch;
      void loop(epoch);
    },

    consumeLanded() {
      const was = landed;
      landed = false;
      return was;
    },

    reset() {
      epoch += 1;
      landed = false;
      pokePending = false;
      wake?.();
      setProgress(null);
    },
  };
}

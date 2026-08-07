// The loop contract under fake timers: cadence, the conflated poke, the
// terminal states, the one-shot landed signal, and sign-out teardown.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRegistrationFlow, type RegistrationFlow } from "./registration-flow";
import type { RegistrationProgress, RegistrationSigner } from "./registration-signer";

const AWAITING_APPROVAL: RegistrationProgress = {
  kind: "awaitingApproval",
  emailVerified: false,
  keyAttached: false,
  keyOnDevice: false,
};

/** A signer that serves a scripted sequence, then repeats the last entry. */
function scriptedSigner(script: RegistrationProgress[]): RegistrationSigner & {
  passes: number;
} {
  const state = { passes: 0 };
  return {
    advance() {
      const index = Math.min(state.passes, script.length - 1);
      state.passes += 1;
      return Promise.resolve(script[index]);
    },
    get passes() {
      return state.passes;
    },
  };
}

async function settle(): Promise<void> {
  // Flush the microtask chain a pass runs on.
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe("registration flow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function start(script: RegistrationProgress[]) {
    const signer = scriptedSigner(script);
    const flow = createRegistrationFlow({ signer });
    flow.ensureAdvancing();
    return { signer, flow };
  }

  it("reports progress from the first pass", async () => {
    const { flow } = start([AWAITING_APPROVAL]);
    expect(flow.progress()).toBeNull();
    await settle();
    expect(flow.progress()).toEqual(AWAITING_APPROVAL);
  });

  it("polls slow on human waits and fast on landing", async () => {
    const { signer } = start([AWAITING_APPROVAL, { kind: "awaitingLanding" }, { kind: "awaitingLanding" }]);
    await settle();
    expect(signer.passes).toBe(1);

    // A human wait: nothing at 3 s, the next pass at 30 s.
    await vi.advanceTimersByTimeAsync(3_000);
    expect(signer.passes).toBe(1);
    await vi.advanceTimersByTimeAsync(27_000);
    expect(signer.passes).toBe(2);

    // Landing: the next pass after only 3 s.
    await vi.advanceTimersByTimeAsync(3_000);
    expect(signer.passes).toBe(3);
  });

  it("polls fast on a transport failure", async () => {
    const { signer } = start([{ kind: "failed", cause: new Error("net") }, AWAITING_APPROVAL]);
    await settle();
    expect(signer.passes).toBe(1);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(signer.passes).toBe(2);
  });

  it("a poke triggers an immediate pass instead of a second loop", async () => {
    const { signer, flow } = start([AWAITING_APPROVAL, AWAITING_APPROVAL]);
    await settle();
    expect(signer.passes).toBe(1);
    flow.ensureAdvancing();
    await settle();
    expect(signer.passes).toBe(2);
    // Still one loop: the next pass keeps the ordinary cadence.
    await vi.advanceTimersByTimeAsync(30_000);
    expect(signer.passes).toBe(3);
  });

  it("a poke during a pass is conflated into one immediate re-pass", async () => {
    const { signer, flow } = start([AWAITING_APPROVAL, AWAITING_APPROVAL]);
    // Poke before the first pass resolves.
    flow.ensureAdvancing();
    flow.ensureAdvancing();
    await settle();
    expect(signer.passes).toBe(2);
  });

  it("stops for good at member and greets a watched landing exactly once", async () => {
    const { signer, flow } = start([{ kind: "awaitingLanding" }, { kind: "member" }]);
    await settle();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(flow.progress()).toEqual({ kind: "member" });
    expect(flow.consumeLanded()).toBe(true);
    expect(flow.consumeLanded()).toBe(false);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(signer.passes).toBe(2);
  });

  it("a cold open as member greets nobody", async () => {
    const { flow } = start([{ kind: "member" }]);
    await settle();
    expect(flow.progress()).toEqual({ kind: "member" });
    expect(flow.consumeLanded()).toBe(false);
  });

  it("a finished loop restarts on the next ensure", async () => {
    const { signer, flow } = start([{ kind: "member" }]);
    await settle();
    expect(signer.passes).toBe(1);
    flow.ensureAdvancing();
    await settle();
    expect(signer.passes).toBe(2);
  });

  it("a device rejection ends the loop", async () => {
    const { signer } = start([{ kind: "rejectedByDevice", reason: "bad seal" }]);
    await settle();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(signer.passes).toBe(1);
  });

  it("notifies subscribers on every report", async () => {
    const { flow } = start([AWAITING_APPROVAL]);
    // Subscribe after start but before the pass lands.
    const seen: (RegistrationProgress | null)[] = [];
    flow.subscribe(() => seen.push(flow.progress()));
    await settle();
    expect(seen).toEqual([AWAITING_APPROVAL]);
  });

  it("reset() discards the in-flight pass and lets the next session start clean", async () => {
    const pending: ((p: RegistrationProgress) => void)[] = [];
    const signer: RegistrationSigner = {
      advance: () =>
        new Promise((resolve) => {
          pending.push(resolve);
        }),
    };
    const flow: RegistrationFlow = createRegistrationFlow({ signer });
    flow.ensureAdvancing();
    await settle();
    flow.reset();
    pending[0]?.(AWAITING_APPROVAL);
    await settle();
    // The old loop's report is discarded — it belongs to a dead epoch.
    expect(flow.progress()).toBeNull();

    // The next session starts a fresh loop.
    flow.ensureAdvancing();
    await settle();
    pending[1]?.(AWAITING_APPROVAL);
    await settle();
    expect(flow.progress()).toEqual(AWAITING_APPROVAL);
  });

  it("reset() clears the landed one-shot", async () => {
    const { flow } = start([{ kind: "awaitingLanding" }, { kind: "member" }]);
    await settle();
    await vi.advanceTimersByTimeAsync(3_000);
    flow.reset();
    expect(flow.consumeLanded()).toBe(false);
  });
});

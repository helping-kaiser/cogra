// The rule a creation surface's Retry runs (same-signing.ts), played on its
// own: what a re-asked batch's answers decide, and what is read before an
// attempt is retired.

import { describe, expect, it, vi } from "vitest";

import { success } from "@/lib/api/outcome";
import type { StagedWriteView } from "@/lib/api/writes-api";
import { expectation } from "@/lib/signing/intent";
import type { WriteResult } from "@/lib/signing/write-signer";
import { askAgain, type SigningAttempt } from "./same-signing";

const ATTEMPT: SigningAttempt = { node: "post-1", writes: ["w1", "w2"], intent: "same" };
const EXPECTED = expectation([]);

function staged(id: string, state: string): StagedWriteView {
  return {
    id,
    state,
    carried: false,
    family: "PUBLISH",
    canonicalProposal: "AA==",
    verifiedAct: null,
    record: null,
  } as unknown as StagedWriteView;
}

function deps(again: (id: string) => WriteResult, states: Record<string, string>) {
  const retired: string[] = [];
  const reads: string[] = [];
  return {
    retired,
    reads,
    deps: {
      signer: { signAgain: vi.fn(async (ids: readonly string[]) => ids.map(again)) },
      read: async (id: string) => {
        reads.push(id);
        return success(staged(id, states[id] ?? "AWAITING_APPROVAL"));
      },
      retire: async (id: string) => void retired.push(id),
    },
  };
}

const deviceRefused = (id: string): WriteResult => ({ kind: "rejectedByDevice", id, reason: "intent mismatch" });

// K-REJECTED-SAME-INTENT-SKIPS-STATE-READ: the device's own intent check
// refuses the whole re-asked batch when the expectation rebuilt for the same
// gesture differs from the staged proposal — the server's facts keyed by the
// gesture's parts (a cited node's L1 id, a media digest) changed between the
// presses. The refusal says nothing about whether the FIRST press's approval
// went out with its answer lost, so the states are read, as for a changed
// gesture.
describe("a re-asked batch the device refuses", () => {
  it("reads the states first: a write already relaying is landing, and nothing is retired", async () => {
    const { deps: d, retired, reads } = deps(deviceRefused, { w1: "RELAYING", w2: "RELAYING" });
    const asked = await askAgain(d, ATTEMPT, "same", EXPECTED);
    expect(asked).toEqual({ kind: "landing" });
    expect(reads).toEqual(["w1"]);
    expect(retired).toEqual([]);
  });

  it("a write already landed is landing too", async () => {
    const { deps: d, retired } = deps(deviceRefused, { w2: "LANDED" });
    expect(await askAgain(d, ATTEMPT, "same", EXPECTED)).toEqual({ kind: "landing" });
    expect(retired).toEqual([]);
  });

  it("with no write relaying or landed, the attempt is retired and a fresh prepare may run", async () => {
    const { deps: d, retired, reads } = deps(deviceRefused, {});
    expect(await askAgain(d, ATTEMPT, "same", EXPECTED)).toEqual({ kind: "fresh" });
    expect(reads).toEqual(["w1", "w2"]);
    expect(retired).toEqual(["w1", "w2"]);
  });

  it("a state read that does not answer decides nothing and retires nothing", async () => {
    const { deps: d, retired } = deps(deviceRefused, {});
    const unanswered = { kind: "failed" as const, cause: new TypeError("Failed to fetch") };
    const asked = await askAgain({ ...d, read: async () => unanswered }, ATTEMPT, "same", EXPECTED);
    expect(asked).toEqual({ kind: "unread", outcome: unanswered });
    expect(retired).toEqual([]);
  });

  it("a batch that ended on terminal refusals alone is retired without a state read", async () => {
    const expired = (id: string): WriteResult => ({
      kind: "refused",
      id,
      errors: [{ code: "STAGED_WRITE_EXPIRED", message: "expired", field: null }],
    });
    const { deps: d, retired, reads } = deps(expired, {});
    expect(await askAgain(d, ATTEMPT, "same", EXPECTED)).toEqual({ kind: "fresh" });
    expect(reads).toEqual([]);
    expect(retired).toEqual(["w1", "w2"]);
  });
});

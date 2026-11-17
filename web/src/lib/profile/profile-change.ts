"use client";

// A profile change that is still signing after its seal was closed, and what
// became of it — the one place the profile's own head reads it from
// (ProfileEditSeal.md: "the reader's own profile stands as it was AND the line
// under its head reads Signing…"; then "That didn't sign." with Retry;
// backlog 165, closed by round 41 (a); Profile.jsx's `change` chip).
//
// WHY A MODULE STORE. From the press on `Sign the change` the seal reads
// `Close` and closing it never cancels the act (jakob 2026-11-11): the
// signing outlives the screen that started it. So the signing runs HERE, and
// the seal and the profile are only two readers of it. While the seal is open
// it owns the answer — its own fault states, its own landing — and the store
// keeps nothing; once the seal has closed, the head carries the wait and the
// failure, and the landing's snackbar confirms a change that is taken.
//
// One change at a time: a profile is one record, and the seal's commit refuses
// a second press while one signs.

import { useSyncExternalStore } from "react";

import { sealFaultOf, sealFaultOfResults } from "@/lib/compose/seal-fault";
import type { WriteResult } from "@/lib/signing/write-signer";
import { carrySnackbar } from "@/lib/ui/carried-snackbar";

/** What one signing of a profile change came to. */
export type ProfileChangeOutcome =
  | { readonly kind: "taken" }
  | { readonly kind: "offline" }
  | { readonly kind: "notThrough"; readonly line: string }
  | { readonly kind: "writeRule" }
  | { readonly kind: "bug" };

/**
 * What one signing came to, for the seals' states: every write taken is the
 * change taken; a refusal reads by the failure pack (`sealFaultOf`: the write
 * rule, an answered fault of the whole act, else a bug); a device's own
 * refusal of the bytes is not through (seam 355); no answer — a transport failure, a seal still
 * out — is the fault line, and a transport fault the server did answer (an
 * INTERNAL) the not-through one (NetworkError.md:3, :13-19).
 */
export function outcomeOf(results: readonly WriteResult[]): ProfileChangeOutcome {
  if (results.every((result) => result.kind === "done" || result.kind === "carried")) return { kind: "taken" };
  const refused = results.flatMap((result) => (result.kind === "refused" ? result.errors : []));
  if (refused.length > 0) {
    const fault = sealFaultOf(refused, []);
    if (fault.kind === "writeRule" || fault.kind === "notThrough") return fault;
    return { kind: "bug" };
  }
  const failed = sealFaultOfResults(results, []);
  return failed.kind === "notThrough" ? failed : { kind: "offline" };
}

/** What the profile's head reads. */
export type ProfileChangeState =
  | { readonly kind: "signing" }
  | { readonly kind: "failed"; readonly retry: () => void };

/** The landing's confirmation (ProfileEditSeal.md: "the signing is taken"). */
export const PROFILE_SIGNED = "Signed — your profile shows it now, still settling.";

let state: ProfileChangeState | null = null;
let closed = false;
/** Counts changes taken after their seal closed, so the profile reads itself again. */
let landed = 0;
const listeners = new Set<() => void>();

function publish(next: ProfileChangeState | null): void {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Runs one signing of a profile change and answers what it came to. If the
 * seal is closed before the answer, the answer is the head's instead: a
 * change taken lands with the snackbar and the profile reads itself again;
 * anything else stands as `That didn't sign.` with a Retry that asks the
 * same signing again.
 */
export async function signProfileChange(
  run: () => Promise<ProfileChangeOutcome>,
  { fromHead = false }: { fromHead?: boolean } = {},
): Promise<ProfileChangeOutcome> {
  // A Retry under the head has no seal to answer to.
  closed = fromHead;
  publish({ kind: "signing" });
  const outcome = await run().catch((): ProfileChangeOutcome => ({ kind: "offline" }));
  if (!closed) {
    // The seal is still there: its own states say what happened.
    publish(null);
    return outcome;
  }
  if (outcome.kind === "taken") {
    landed += 1;
    publish(null);
    carrySnackbar(PROFILE_SIGNED);
  } else {
    publish({
      kind: "failed",
      retry: () => void signProfileChange(run, { fromHead: true }),
    });
  }
  return outcome;
}

/** The seal closed while its change signs: the head takes the answer. */
export function closeProfileChangeSeal(): void {
  if (state?.kind === "signing") closed = true;
}

/** The head's line, null where nothing stands there. */
export function useProfileChange(): ProfileChangeState | null {
  return useSyncExternalStore(subscribe, () => state, () => null);
}

/** Bumps each time a closed seal's change is taken — the profile's cue to read itself again. */
export function useProfileChangesLanded(): number {
  return useSyncExternalStore(subscribe, () => landed, () => 0);
}

export function resetProfileChangeForTests(): void {
  state = null;
  closed = false;
  landed = 0;
}

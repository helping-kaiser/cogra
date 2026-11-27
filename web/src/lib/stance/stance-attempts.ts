// THE PICK A TARGET'S SIGNING STARTED, kept until it answers done
// (SigningAfterClose.md:27: "WHEN tap Retry on a line of this pattern -> the
// same signing is asked again … AND NEVER anything else is signed";
// PadFailed.md:51, RowSigning.md:23: "the same pick is signed again").
//
// A stance is a SUM of records (api-spec.md "The read-side bundle fold":
// same-author sum-then-clip), and the server stages every `prepareStance` as
// a record of its own (crates/api stance.rs `prepare_stance`: no in-flight
// rule). So a Retry that prepares afresh beside a first attempt the server
// already took — its answer lost on the way back — sums the pick twice and
// prices it twice. The seam remembers each target's attempt here, and its
// next commit toward that target asks it again (`askAgain`, same-signing.ts).
// A walk-back keeps a slot of its OWN beside the target's pick slot: a fresh
// one beside a first is refused as already netted, or staged twice, so its
// Retry asks the first again — but a pick and a walk-back are different
// gestures, and one never retires or "lands on" the other's attempt. Across
// kinds each goes main's road, and the server nets what it holds.
//
// Memory only, per target, kept beside the account that pressed (auth.md
// "Multi-account device custody": bound "to the account it belongs to, never
// to a device-global slot"): a reload forgets it and Home's Resume continues
// what was parked. Several accounts share a tab, so an account boundary hands
// nothing over — another account never asks one, and its own finds it again
// when it is back, so its Retry asks the same signing rather than preparing
// afresh beside stagings the server may still hold. A gesture reads and
// settles only its own account's attempts (`of`), whichever account is
// active when it answers.

import { intentOf, type SigningAttempt } from "@/lib/compose/same-signing";
import type { Expectation } from "@/lib/signing/intent";
import type { StancePair } from "./model";
import type { StanceTarget } from "./stance-data";

/**
 * The kept picks' seal: one batch across many targets, signed in one pass
 * (KeptPicksSeal.md:63: "the whole batch is asked to sign again"), so it
 * keeps one slot of its own beside the targets'.
 */
export const KEPT_BATCH = "keptBatch";

/** What an attempt is kept under: a target's pick, its walk-back, or the kept picks' batch. */
export type Slot = StanceTarget | { readonly walkBack: StanceTarget } | typeof KEPT_BATCH;

/** A target's attempt, and what its batch was checked against when it was staged. */
export type StanceAttempt = SigningAttempt & { readonly expected: Expectation };

/**
 * AN ATTEMPT IN FLIGHT IS NOT A FAILED ATTEMPT. Only one whose own signing
 * call has returned not done is one a later commit asks again (`answered`);
 * while a commit toward the target is still asking (`asking`), another
 * commit there is an act of its own — the anchor refuses a second act while
 * it signs (PadFailed.md:17, :37, :41), but that guard is per control, and
 * the seam is shared by every surface showing the target.
 */
export type StanceAttempts = {
  /** Whether a commit toward the target is signing or asking again right now. */
  asking(slot: Slot): boolean;
  /** The attempt whose signing answered not done, for a Retry to ask again. */
  answered(slot: Slot): StanceAttempt | null;
  /** Holds the target from the commit's first step, before anything is staged. */
  begin(slot: Slot): void;
  /** The asking commit's batch, staged and about to be signed. */
  remember(slot: Slot, attempt: StanceAttempt): void;
  /** The asking commit answered not done: its attempt, if any, waits for a Retry. */
  settle(slot: Slot): void;
  forget(slot: Slot): void;
};

const targetKey = (target: StanceTarget) => `${target.kind}:${target.id}`;
const keyOf = (slot: Slot) =>
  slot === KEPT_BATCH ? "kept:batch" : "walkBack" in slot ? `sever:${targetKey(slot.walkBack)}` : targetKey(slot);

/** The gesture a commit toward `target` was prepared from; a changed pick is another signing. */
export function stanceIntent(target: StanceTarget, pick: StancePair): string {
  return intentOf({ target: keyOf(target), pDirected: pick.pDirected, pInterest: pick.pInterest });
}

/** The kept picks' batch: every pick, in order; a changed or dropped pick is another signing. */
export function keptBatchIntent(entries: readonly { target: StanceTarget; pick: StancePair }[]): string {
  return intentOf({
    batch: entries.map(({ target, pick }) => [keyOf(target), pick.pDirected, pick.pInterest]),
  });
}

/** The walk-back toward `target`: one gesture whatever it nets, so its Retry is always the same. */
export function severanceIntent(target: StanceTarget): string {
  return intentOf({ target: keyOf(target), sever: true });
}

/** Every account's attempts in the tab, each account's apart. */
export type AccountStanceAttempts = {
  /** The attempts of `owner` — the account a gesture was pressed as. */
  of(owner: string | null): StanceAttempts;
};

export function createStanceAttempts(): AccountStanceAttempts {
  const accounts = new Map<string | null, StanceAttempts>();
  return {
    of: (owner) => {
      const known = accounts.get(owner);
      if (known !== undefined) return known;
      const fresh = createAccountAttempts();
      accounts.set(owner, fresh);
      return fresh;
    },
  };
}

function createAccountAttempts(): StanceAttempts {
  const attempts = new Map<string, { attempt: StanceAttempt | null; asking: boolean }>();
  const held = (slot: Slot) => attempts.get(keyOf(slot));
  return {
    asking: (target) => held(target)?.asking === true,
    answered: (target) => {
      const entry = held(target);
      return entry !== undefined && !entry.asking ? entry.attempt : null;
    },
    begin: (target) => {
      const entry = held(target);
      if (entry !== undefined) entry.asking = true;
      else attempts.set(keyOf(target), { attempt: null, asking: true });
    },
    remember: (target, attempt) => {
      const entry = held(target);
      // Only a commit that holds the slot (`begin`) remembers.
      if (entry !== undefined) entry.attempt = attempt;
    },
    settle: (target) => {
      const entry = held(target);
      if (entry === undefined) return;
      if (entry.attempt === null) attempts.delete(keyOf(target));
      else entry.asking = false;
    },
    forget: (target) => void attempts.delete(keyOf(target)),
  };
}

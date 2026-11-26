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
//
// Memory only, per target, for the tab's active account: a reload forgets it
// and Home's Resume continues what was parked, and an account boundary lets
// every attempt go, so no other account ever asks one again.

import { intentOf, type SigningAttempt } from "@/lib/compose/same-signing";
import { onAccountChange } from "@/lib/session/account-change";
import type { TokenStore } from "@/lib/session/token-store";
import type { StancePair } from "./model";
import type { StanceTarget } from "./stance-data";

/** A target's attempt, and the pick it was prepared from — what its expectation names. */
export type StanceAttempt = SigningAttempt & { readonly pick: StancePair };

export type StanceAttempts = {
  toward(target: StanceTarget): StanceAttempt | null;
  remember(target: StanceTarget, attempt: StanceAttempt): void;
  forget(target: StanceTarget): void;
};

const keyOf = (target: StanceTarget) => `${target.kind}:${target.id}`;

/** The gesture a commit toward `target` was prepared from; a changed pick is another signing. */
export function stanceIntent(target: StanceTarget, pick: StancePair): string {
  return intentOf({ target: keyOf(target), pDirected: pick.pDirected, pInterest: pick.pInterest });
}

export function createStanceAttempts(
  accounts?: Pick<TokenStore, "activeAccountId" | "subscribe">,
): StanceAttempts {
  const attempts = new Map<string, StanceAttempt>();
  onAccountChange(() => attempts.clear(), accounts);
  return {
    toward: (target) => attempts.get(keyOf(target)) ?? null,
    remember: (target, attempt) => void attempts.set(keyOf(target), attempt),
    forget: (target) => void attempts.delete(keyOf(target)),
  };
}

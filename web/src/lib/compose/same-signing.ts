// What a creation surface's Retry does with the signing it already started.
//
// SigningAfterClose.md:27: "WHEN tap Retry on a line of this pattern -> the
// same signing is asked again … AND NEVER anything else is signed". A fresh
// prepare is not the same signing: it stages a second act beside the first,
// whose stored material Home's Resume would still approve — two posts, two
// prices (the retry characterisation in write-signer.retry.test.ts). So a
// surface remembers the attempt it prepared, and its Retry comes here first.
//
// THE RULE, by what the attempt's writes say now:
// - The reader changed nothing → the same batch is signed again from where it
//   stands (`WriteSigner.signAgain`): approved writes answer done, parked ones
//   continue on their stored material. Only an attempt that can no longer land
//   — expired, gone, refused for good — is retired, and only then is a fresh
//   prepare allowed. An attempt a part of which already answered done is never
//   re-prepared: that part is landing, and a second act would sit on top of it.
// - The reader changed what would be signed → an attempt this device already
//   approved is landing with its first content, and the surface finishes as if
//   it had answered; any other attempt is retired first, so it can never land
//   later, and then the new content is prepared.
//
// RETIRING IS FORGETTING THE DEVICE'S MATERIAL. A write lands only once its
// author's approval witness is relayed ("only an approved act is orderable",
// api-spec.md "The API prepares and relays; only the device signs"), the
// witness is checked against the author's key before it is held
// (crates/api relay.rs `check_witness`), and this device can sign one only
// over the nonces it stored at the pre-signature (write-signer.ts: a
// pre-committed write without them is refused "handshake material lost").
// With the material gone the write waits unapproved until it is collected.

import type { Outcome } from "@/lib/api/outcome";
import type { StagedWriteView } from "@/lib/api/writes-api";
import type { Expectation } from "@/lib/signing/intent";
import { TERMINAL_REFUSALS, type WriteResult, type WriteSigner } from "@/lib/signing/write-signer";

/** The signing a surface started: the batch it prepared, and what it was prepared from. */
export type SigningAttempt = {
  /** The node the batch mints. */
  readonly node: string;
  /** The batch's staged-write ids, in relay order. */
  readonly writes: readonly string[];
  /** The gesture the batch was prepared from (`intentOf`); a changed one is a different signing. */
  readonly intent: string;
};

/** The prepare's request, as the attempt's key: any field the reader changes changes it. */
export function intentOf(sent: unknown): string {
  return JSON.stringify(sent);
}

export type AskedAgain =
  /** The same batch was signed again; the results read as a `sign`'s. */
  | { readonly kind: "signed"; readonly results: readonly WriteResult[] }
  /** The reader changed the gesture, but the first attempt was approved: it is landing. */
  | { readonly kind: "landing" }
  /** The attempt is retired; a fresh prepare may run. */
  | { readonly kind: "fresh" }
  /** A state read did not answer: nothing decided, nothing signed. */
  | { readonly kind: "unread"; readonly outcome: Outcome<unknown> };

function ended(result: WriteResult): boolean {
  if (result.kind === "rejectedByDevice") return true;
  return (
    result.kind === "refused" &&
    result.errors.length > 0 &&
    result.errors.every((error) => TERMINAL_REFUSALS.has(error.code))
  );
}

export async function askAgain(
  deps: {
    readonly signer: Pick<WriteSigner, "signAgain">;
    readonly read: (id: string) => Promise<Outcome<StagedWriteView | null>>;
    /** Forgets this device's material for one staged write (`IdentityStore.clearHandshake`). */
    readonly retire: (id: string) => Promise<void>;
  },
  attempt: SigningAttempt,
  intent: string,
  /** The attempt's own expectation, rebuilt from the form for its node. */
  expected: Expectation,
): Promise<AskedAgain> {
  const retireAll = async (): Promise<AskedAgain> => {
    for (const id of attempt.writes) await deps.retire(id);
    return { kind: "fresh" };
  };

  if (intent === attempt.intent) {
    // A stand-in without the scoped re-sign cannot ask again; retiring keeps
    // the one guarantee that matters, that no second act lands beside it.
    if (deps.signer.signAgain === undefined) return retireAll();
    const results = await deps.signer.signAgain(attempt.writes, expected);
    if (results.some((result) => result.kind === "done")) return { kind: "signed", results };
    if (results.some(ended)) return retireAll();
    return { kind: "signed", results };
  }

  for (const id of attempt.writes) {
    const read = await deps.read(id);
    if (read.kind !== "success") return { kind: "unread", outcome: read };
    const state = read.value?.state;
    if (state === "RELAYING" || state === "LANDED") return { kind: "landing" };
  }
  return retireAll();
}

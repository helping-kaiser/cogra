// What became of a seal's press, when it did not leave the seal — the failure
// pack's reading of a refusal (jakob 2026-09-30/10-01; copy-voice, *Faults by
// code*; SealFaultRow.md, SealFaultBug.md).
//
// THREE REFUSALS READ NOTHING ALIKE, so the seal tells them apart here, from
// the contract's own error codes and field paths, rather than printing the
// first error's sentence:
// - the WRITE RULE (`WRITE_RULE_FAILED`): a rule working as meant, nothing
//   failed and nothing was spent — the notice, never Retry;
// - ONE STAGED CITATION whose target is gone (`NOT_FOUND` on
//   `references.<index>.target`): a target that landed never stops answering,
//   so this is a cited post or comment that never landed — said on its row;
// - an ANSWERED refusal of the whole act (`notThrough`, carrying its line):
//   FORBIDDEN, INTERNAL, SIGNATURE_INVALID or a BAD_INPUT naming no field read
//   `That didn't go through. Try again.`, EMAIL_NOT_VERIFIED reads its own
//   line, with Retry in the commit's place — never the no-answer line,
//   because the server answered, and never a row (NetworkError.md:13-19);
// - ANY OTHER refusal of a staged act: a bug the picking stage should have
//   blocked — the notice in the bug's own words, and no row marked.

import { pathIndex } from "@/lib/api/field-errors";
import type { Outcome, UserError } from "@/lib/api/outcome";
import type { ReferenceDraft } from "@/lib/references/draft";
import type { WriteResult } from "@/lib/signing/write-signer";
import { answeredFaultLine, NOT_THROUGH_LINE, outcomeFaultLine, wholeActLine } from "@/lib/ui/error-messages";

export type SealFault =
  | { readonly kind: "offline" }
  | { readonly kind: "notThrough"; readonly line: string }
  | { readonly kind: "row"; readonly targetId: string }
  | { readonly kind: "bug" }
  | { readonly kind: "writeRule" };

export function sealFaultOf(
  errors: readonly UserError[],
  references: readonly ReferenceDraft[],
): SealFault {
  if (errors.some((error) => error.code === "WRITE_RULE_FAILED")) return { kind: "writeRule" };
  const line = wholeActLine(errors);
  if (line !== null) return { kind: "notThrough", line };
  for (const error of errors) {
    const index = pathIndex(error.field, "references");
    const onTarget = error.field !== null && error.field.length === 3 && error.field[2] === "target";
    const reference = index === null ? undefined : references[index];
    if (error.code === "NOT_FOUND" && onTarget && reference !== undefined) {
      return { kind: "row", targetId: reference.targetId };
    }
  }
  return { kind: "bug" };
}

/**
 * A transport fault, read: an answer the server gave on its `errors` array
 * (an INTERNAL) is `notThrough`; only a fault with no answer behind it is the
 * no-answer line (NetworkError.md:3, :13).
 */
export function sealFaultOfFailure(cause: unknown): SealFault {
  const line = answeredFaultLine(cause);
  return line === null ? { kind: "offline" } : { kind: "notThrough", line };
}

/**
 * What a signed batch that did not all go through reads as: its first
 * refusal by `sealFaultOf`, then a device's own refusal as not through,
 * else a failed leg by `sealFaultOfFailure`.
 */
export function sealFaultOfResults(
  results: readonly WriteResult[],
  references: readonly ReferenceDraft[],
): SealFault {
  const refused = results.find((result) => result.kind === "refused");
  if (refused !== undefined && refused.kind === "refused") return sealFaultOf(refused.errors, references);
  // The device's own signer refused the bytes: an answer, not through (seam 355).
  if (results.some((result) => result.kind === "rejectedByDevice")) {
    return { kind: "notThrough", line: NOT_THROUGH_LINE };
  }
  for (const result of results) {
    if (result.kind !== "failed") continue;
    const fault = sealFaultOfFailure(result.cause);
    if (fault.kind === "notThrough") return fault;
  }
  return { kind: "offline" };
}

/**
 * A read the commit waits on, not answered with what it needed: an answered
 * whole-act fault is `notThrough`, anything else the no-answer line.
 */
export function sealFaultOfOutcome(outcome: Outcome<unknown>): SealFault {
  const line = outcomeFaultLine(outcome);
  return line === null ? { kind: "offline" } : { kind: "notThrough", line };
}

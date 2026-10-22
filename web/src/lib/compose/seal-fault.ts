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
// - ANY OTHER refusal of a staged act: a bug the picking stage should have
//   blocked — the notice in the bug's own words, and no row marked.

import { pathIndex } from "@/lib/api/field-errors";
import type { UserError } from "@/lib/api/outcome";
import type { ReferenceDraft } from "@/lib/references/draft";

export type SealFault =
  | { readonly kind: "offline" }
  | { readonly kind: "row"; readonly targetId: string }
  | { readonly kind: "bug" }
  | { readonly kind: "writeRule" };

export function sealFaultOf(
  errors: readonly UserError[],
  references: readonly ReferenceDraft[],
): SealFault {
  if (errors.some((error) => error.code === "WRITE_RULE_FAILED")) return { kind: "writeRule" };
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

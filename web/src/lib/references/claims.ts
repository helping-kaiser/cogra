// `ReferenceClaim[]` off any content node, projected down to what the
// two surfaces need: the read-only chip row, and the editable section.
//
// The two identifiers are NOT interchangeable, and this is the seam that
// keeps them apart. A claim's `targetId` is the raw L1 identifier — a
// substrate fact, always present even when CoGra cannot type the far
// end — while `ReferenceInput.target` and both prepare mutations name
// the L2 `UUID`, which only the TYPED target carries as its `id`.
//
// So a claim whose `target` is null renders (off the L1 id, navigating
// nowhere) but cannot be staged: there is no L2 id to name it by. Such a
// claim is excluded from the editable section entirely — present in
// neither the baseline nor the draft — so it can never be mistaken for
// one the author removed, and no withdrawal is ever staged for a target
// this client cannot address.

import { newReferenceDraft, type ReferenceDraft } from "./draft";
import { targetView, untypedTargetView } from "./normalize";
import type { ReferenceChipEntry } from "@/lib/ui/reference-chip-row";
import type { ReferenceTargetNode } from "./normalize";

/** A `ReferenceClaim` as the wire serves it. */
export type ReferenceClaimNode = {
  /** The raw L1 identifier — always present, never a `ReferenceInput` target. */
  readonly targetId: string;
  readonly relevance: number;
  readonly support: number;
  readonly pending: boolean;
  /** Null when CoGra carries no display row for the referenced node. */
  readonly target?: ReferenceTargetNode | null;
};

/** The row's shape: every claim renders, typed or not. */
export function referenceChipEntries(
  claims: readonly ReferenceClaimNode[],
): readonly ReferenceChipEntry[] {
  return claims.map((claim) => ({
    targetId: claim.targetId,
    target:
      claim.target === null || claim.target === undefined
        ? untypedTargetView(claim.targetId)
        : targetView(claim.target, claim.targetId),
    pending: claim.pending,
    relevance: claim.relevance,
    support: claim.support,
  }));
}

/**
 * The section's shape: only claims this client can name back to the
 * server, keyed by the L2 id both prepare mutations consume.
 */
export function referenceDrafts(
  claims: readonly ReferenceClaimNode[],
): readonly ReferenceDraft[] {
  const drafts: ReferenceDraft[] = [];
  for (const claim of claims) {
    const target = claim.target;
    if (target === null || target === undefined) continue;
    const id = target.id;
    if (id === undefined) continue;
    drafts.push({
      ...newReferenceDraft(id, targetView(target, claim.targetId)),
      relevance: claim.relevance,
      support: claim.support,
    });
  }
  return drafts;
}

/** How many of a node's claims the editable section cannot address. */
export function unaddressableClaims(claims: readonly ReferenceClaimNode[]): number {
  return claims.length - referenceDrafts(claims).length;
}

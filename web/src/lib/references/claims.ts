// `ReferenceClaim[]` off any content node, projected down to what the
// editable section needs.
//
// A CARD NEVER LISTS ITS REFERENCES INLINE (design/readme.md:1148-1150): a
// content card states them as a count on its topics line, and the full set —
// with the pair each claim carries — lives in the topics-and-references sheet.
// So there is no read-only row shape here any more, only the drafts.
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
import { targetView } from "./normalize";
import type { ReferenceTargetNode } from "./normalize";

/** A `ReferenceClaim` as the wire serves it. */
export type ReferenceClaimNode = {
  /** The raw L1 identifier — always present, never a `ReferenceInput` target. */
  readonly targetId: string;
  readonly relevance: number;
  readonly support: number;
  /**
   * What removing this citation costs, off the raw bundle sums. Every
   * document selects it, read-only rows included: the content types
   * are shared across surfaces — the feed's `PostView` is what the
   * detail's post is read through — so a claim that could reach an
   * editing surface has to carry the number that surface confirms on.
   */
  readonly withdrawalCost: number;
  readonly pending: boolean;
  /** Null when CoGra carries no display row for the referenced node. */
  readonly target?: ReferenceTargetNode | null;
};

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
      withdrawalCost: claim.withdrawalCost,
    });
  }
  return drafts;
}

/** How many of a node's claims the editable section cannot address. */
export function unaddressableClaims(claims: readonly ReferenceClaimNode[]): number {
  return claims.filter((claim) => claim.target?.id === undefined).length;
}

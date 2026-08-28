// The drafted reference as every referencing surface carries it: the
// cited node's L2 id, enough of the target to render a chip, and the two
// parameters that ride `ReferenceInput` (api-spec.md: `pDirected` is
// effort `f`, surfaced as RELEVANCE; `pInterest` is enthusiasm `e`,
// surfaced as SUPPORT — D1). The defaults mirror the server's own, so an
// untouched pair commits exactly what omitting the fields would have.
//
// D20 fixes the vocabulary: the user-facing word is Reference, never
// "cite" or "citation", and a reference whose target is a person is a
// MENTION. D21 fixes the range: topics are TAGGED, not referenced.
//
// A reference is never withdrawn by deletion. Reference withdrawal is
// per-leg net stance (D4, D11), so a removal is the severance shape:
// counter-records until the `(author, artifact, target)` bundle reaches
// `(0, 0)`. That is why the edit surfaces come out of here as acts
// rather than as a diff to apply.

/**
 * The classes a reference may point at (`union ReferenceTarget`).
 * D21: a topic is TAGGED, never referenced — referencing is for the
 * other passive node classes.
 */
export type ReferenceTargetKind = "Post" | "Comment" | "User";

/**
 * What a chip needs to render without re-reading the target: its class,
 * the route it opens, and its label. Null `kind` is a claim CoGra
 * carries no display row for — it renders as a plain, non-navigating
 * chip off `targetId` alone (D16).
 */
export type ReferenceTargetView = {
  readonly kind: ReferenceTargetKind | null;
  /** `@handle` or a snippet — already in the reader's words. */
  readonly label: string;
  /** Where the chip navigates; null for a target with no route. */
  readonly href: string | null;
  /**
   * A profile target renders as the ACTOR CHIP (D16), which needs the
   * handle and display name rather than a flat label. Absent for every
   * other class, and for a target with no display row.
   */
  readonly handle?: string;
  readonly displayName?: string | null;
};

export type ReferenceDraft = {
  /** The cited node's L2 id — what `ReferenceInput.target` names. */
  readonly targetId: string;
  readonly target: ReferenceTargetView;
  /** Effort `f`, the `pDirected` slot, bipolar over the census range. */
  readonly relevance: number;
  /** Enthusiasm `e`, the `pInterest` slot, bipolar over the census range. */
  readonly support: number;
  /**
   * How many counter-records withdrawing this reference stages —
   * `ReferenceClaim.withdrawalCost`, served off the RAW bundle sums the
   * clipped pair above has already lost. One for anything not yet
   * standing: a reference the author drafted in this session nets in a
   * single record, and dropping one before submitting stages nothing at
   * all.
   */
  readonly withdrawalCost: number;
};

export const DEFAULT_RELEVANCE = 0.1;
export const DEFAULT_SUPPORT = 0.1;

export const RELEVANCE_MIN = -1;
export const RELEVANCE_MAX = 1;
export const SUPPORT_MIN = -1;
export const SUPPORT_MAX = 1;

export function newReferenceDraft(
  targetId: string,
  target: ReferenceTargetView,
): ReferenceDraft {
  return {
    targetId,
    target,
    relevance: DEFAULT_RELEVANCE,
    support: DEFAULT_SUPPORT,
    withdrawalCost: 1,
  };
}

/** One staged Reference act an edit surface owes the signing flow. */
export type ReferenceChange =
  | { readonly kind: "reference"; readonly reference: ReferenceDraft }
  | { readonly kind: "withdraw"; readonly reference: ReferenceDraft };

function sameParameters(a: ReferenceDraft, b: ReferenceDraft): boolean {
  return a.relevance === b.relevance && a.support === b.support;
}

/**
 * What an edit surface has to stage: a reference the author added, one
 * whose parameters they moved (a fresh declaration at the new values),
 * and one they took off (a withdrawal, which is a BATCH of
 * `withdrawalCost` records). An untouched section yields nothing.
 */
export function referenceChanges(
  original: readonly ReferenceDraft[],
  draft: readonly ReferenceDraft[],
): readonly ReferenceChange[] {
  const before = new Map(original.map((reference) => [reference.targetId, reference]));
  const drafted = new Set(draft.map((reference) => reference.targetId));
  const changes: ReferenceChange[] = [];
  for (const reference of draft) {
    const was = before.get(reference.targetId);
    if (was === undefined || !sameParameters(was, reference)) {
      changes.push({ kind: "reference", reference });
    }
  }
  for (const reference of original) {
    if (!drafted.has(reference.targetId)) changes.push({ kind: "withdraw", reference });
  }
  return changes;
}

/**
 * The act count for a set of staged changes: one act per declaration,
 * and a withdrawal's whole counter-record batch per removal.
 *
 * Exact, because the server quotes it: `ReferenceClaim.withdrawalCost`
 * is `⌈max(|Σ_d|, |Σ_i|)⌉` off the raw bundle sums, the same number
 * `prepareReferenceWithdrawal` then stages. So a removal can be
 * confirmed BEFORE anything is prepared, the order every other
 * multi-act gesture follows.
 */
export function referenceActs(changes: readonly ReferenceChange[]): number {
  return changes.reduce(
    (total, change) =>
      total + (change.kind === "withdraw" ? change.reference.withdrawalCost : 1),
    0,
  );
}

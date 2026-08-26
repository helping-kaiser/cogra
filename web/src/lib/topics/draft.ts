// The drafted tag as every tagging surface carries it: a canonical name
// plus the two parameters that ride `TagInput` (api-spec.md: `pDirected`
// is relevance `r`, `pInterest` is confidence `c`). The defaults mirror
// the server's own, so an untouched slider commits exactly what omitting
// the field would have.
//
// A tag is never withdrawn by deletion — a removal is another Tag act at
// relevance 0 (hashtag.md §4), which is why the edit screen's changes
// come out of here as acts rather than as a diff to apply.

export type TagDraft = {
  readonly name: string;
  /** Relevance `r`, bipolar over the census range. */
  readonly relevance: number;
  /** Confidence `c`, census-bounded to `[0, 1]`. */
  readonly confidence: number;
};

export const DEFAULT_RELEVANCE = 0.1;
export const DEFAULT_CONFIDENCE = 1;

export const RELEVANCE_MIN = -1;
export const RELEVANCE_MAX = 1;
export const CONFIDENCE_MIN = 0;
export const CONFIDENCE_MAX = 1;

/** The relevance that withdraws a claim (hashtag.md §4). */
export const WITHDRAWN_RELEVANCE = 0;

export function newTagDraft(name: string): TagDraft {
  return { name, relevance: DEFAULT_RELEVANCE, confidence: DEFAULT_CONFIDENCE };
}

/** One staged Tag act the edit screen owes the signing flow. */
export type TagChange =
  | { readonly kind: "tag"; readonly tag: TagDraft }
  | { readonly kind: "untag"; readonly name: string };

function sameParameters(a: TagDraft, b: TagDraft): boolean {
  return a.relevance === b.relevance && a.confidence === b.confidence;
}

/**
 * What the edit screen has to stage: a tag the author added, a tag whose
 * parameters they moved (a fresh declaration at the new values), and a
 * tag they took off (relevance 0). Each is its own priced act — the
 * count is what the F4 indicator reports.
 */
export function tagChanges(
  original: readonly TagDraft[],
  draft: readonly TagDraft[],
): readonly TagChange[] {
  const before = new Map(original.map((tag) => [tag.name, tag]));
  const drafted = new Set(draft.map((tag) => tag.name));
  const changes: TagChange[] = [];
  for (const tag of draft) {
    const was = before.get(tag.name);
    if (was === undefined || !sameParameters(was, tag)) changes.push({ kind: "tag", tag });
  }
  for (const tag of original) {
    if (!drafted.has(tag.name)) changes.push({ kind: "untag", name: tag.name });
  }
  return changes;
}

"use client";

// The read-only reference row (D16): a post or comment's current
// references (`Post.references` / `Comment.references`), each chip
// opening the target's existing route. Deliberately plain — the
// body-integrated render arrives with jakob's mention design (D15, D16),
// so this hits the redesign once.
//
// D12: the server already serves only the content author's own current
// references this slice — the content-intrinsic channel, the one that
// needs no forward-path weight. This component renders exactly what it
// is given, with no further filtering.
//
// The values toggle mirrors the topic row's (F8): anyone may see how
// strongly a reference is claimed, but only when they ASK. The detail
// view passes `revealable`, which puts ONE toggle on the row; the feed
// card passes nothing and stays plain. The values enter the DOM only
// while revealed, so a screen reader meets them the same moment the eye
// does rather than reading a hidden pair on every card.

import { useId, useState } from "react";

import type { ReferenceTargetView } from "@/lib/references/draft";
import { ReferenceChip } from "./reference-chip";
import { formatReferenceParams, formatReferenceParamWords } from "./reference-format";

export type ReferenceChipEntry = {
  /** The claim's raw L1 identifier — always present, and the row's key. */
  readonly targetId: string;
  readonly target: ReferenceTargetView;
  readonly pending: boolean;
  /** The claim's `(relevance, support)`, for a row that can reveal. */
  readonly relevance?: number;
  readonly support?: number;
};

export function ReferenceChipRow({
  references,
  testIdPrefix,
  revealable = false,
}: {
  references: readonly ReferenceChipEntry[];
  testIdPrefix: string;
  /** Offer the values toggle. Detail surfaces only — never a card. */
  revealable?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const listId = useId();
  if (references.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <ul
        id={listId}
        className="flex flex-wrap gap-2"
        data-testid={`${testIdPrefix}-references`}
      >
        {references.map((reference) => (
          <li key={reference.targetId} className="flex items-center gap-1">
            <ReferenceChip
              target={reference.target}
              pending={reference.pending}
              testId={`${testIdPrefix}-reference-${reference.targetId}`}
            />
            {revealable && revealed && (
              <span
                data-testid={`${testIdPrefix}-reference-${reference.targetId}-values`}
                className="text-label-small text-on-surface-variant"
              >
                {/* The compact pair for the eye, the named axes for a
                    reader who has no row in front of them — the stance
                    readout's own split (design.md §8.3). */}
                <span aria-hidden="true">
                  {formatReferenceParams(reference.relevance ?? 0, reference.support ?? 0)}
                </span>
                <span className="sr-only">
                  {formatReferenceParamWords(reference.relevance ?? 0, reference.support ?? 0)}
                </span>
              </span>
            )}
          </li>
        ))}
      </ul>
      {/* One affordance for the whole row, not one per chip: the reader
          asks about the references, not about a reference. A plain
          button, so Enter/Space and the expanded state come from the
          platform. */}
      {revealable && (
        <button
          type="button"
          aria-expanded={revealed}
          aria-controls={listId}
          data-testid={`${testIdPrefix}-references-reveal`}
          onClick={() => setRevealed((current) => !current)}
          className="self-start text-label-small text-on-surface-variant underline"
        >
          {revealed ? "Hide reference values" : "Show reference values"}
        </button>
      )}
    </div>
  );
}

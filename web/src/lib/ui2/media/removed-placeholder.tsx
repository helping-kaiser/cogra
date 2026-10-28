// The Removed mark — `RedactedContent` (design/components/honesty/
// SensitiveVeil.jsx): a calm statement of fact where the content was, never a
// silent gap.
//
// TWO REASONS, TWO WORDINGS, and they must never read alike. Collapsing them
// would let a moderation verdict hide behind an author's own decision, or the
// reverse; the docs require the two to be distinguishable, and this is the
// component that keeps them so. An author's own removal and the sweep their
// account deletion chose are ONE wording (copy-voice, ER-G3: "the author chose
// the sweep") — the data keeps them apart (`Removal.by`), the reader does not.
//
// REDACTION IS RECORD-GRANULAR: a removal takes the record's payload, and the
// binding content commitment forbids partial rewrite — so every authored field
// goes at once. There is no redacted title beside a surviving body. This
// component therefore replaces a node's ENTIRE content region and has no
// narrower form.
//
// What remains around it is the skeleton, and the skeleton is the point: the
// author, the timestamp, the thread position, the standing, the stance a reader
// can still take. No record leaves the graph, and no removal is silent.
//
// No `error` colouring. A removal is not a failure, and colouring it as one
// editorialises an author's own choice.
//
// EACH LINE SETS ITS WHOLE TYPE ROLE (round 20, seam 245 ask 6): the role
// utilities carry size, leading, tracking and weight together, so none of them
// borrows the page's body-large leading.

import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";

export type RemovalReason = "author" | "platform";

const WORDING: Record<RemovalReason, { line: string; detail: string }> = {
  // Removed by choice (erasure §1). Reads as the author's decision, because it
  // is one — the decided mark of copy-voice, both lines.
  author: {
    line: "Removed by its author",
    detail: "The words and pictures are gone. The post's place in the thread, and every response, remain.",
  },
  // Removed for cause, by a passed proposal. Says what happened in the reader's
  // words — the verdict is about the content, not an accusation of the author,
  // and the vote is what makes it a public fact rather than a moderator's
  // opinion.
  platform: {
    line: "Removed under the platform's rules",
    detail: "A passed proposal removed it. The decision is public.",
  },
};

/**
 * A comment's second line (copy-voice, the comment-removal round; the board's
 * `REMOVED_COMMENT_NOTE`): the noun swaps, and the mark itself does not.
 */
export const REMOVED_COMMENT_NOTE = "The comment's place in the thread, and every response, remain.";

export function RemovedPlaceholder({
  reason,
  when,
  note,
  node,
  testId = "removed-placeholder",
}: {
  reason: RemovalReason;
  /**
   * When it was removed, in the one age ladder (`ladderAge` of
   * `Removal.at`) — the removal's own moment, never the content's age.
   * Rendered as given: formatting is the caller's job.
   */
  when?: string;
  /** Replaces the second line where a case needs its own wording. */
  note?: string;
  /** The registered mark; it names its parts `line`, `detail` and `when`. */
  node?: DataNode;
  testId?: string;
}) {
  const copy = WORDING[reason];

  return (
    <div
      {...testAttributes(node, testId)}
      data-reason={reason}
      // The same reserved surface an unloaded media tile uses, and for the same
      // reason: this is a space KEPT, not a space lost.
      className="flex flex-col gap-1 rounded-medium bg-surface-container-high p-4"
    >
      <span className="text-body-medium text-on-surface" {...testAttributes(part(node, "line"))}>
        {copy.line}
      </span>
      <span
        className="text-pretty text-body-small text-on-surface-variant"
        {...testAttributes(part(node, "detail"))}
      >
        {note ?? copy.detail}
      </span>
      {when !== undefined && when !== "" && (
        <span className="text-label-small text-on-surface-variant" {...testAttributes(part(node, "when"))}>
          {when}
        </span>
      )}
    </div>
  );
}

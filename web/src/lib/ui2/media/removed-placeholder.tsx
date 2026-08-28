// The Removed placeholder — a calm statement of fact where the content was,
// never a silent gap.
//
// TWO REASONS, TWO WORDINGS, and they must never read alike. Collapsing them
// would let a moderation verdict hide behind an author's own decision, or the
// reverse; the docs require the two to be distinguishable, and this is the
// component that keeps them so.
//
// REDACTION IS RECORD-GRANULAR: an `illegal` verdict removes the record's
// payload, and the binding content commitment forbids partial rewrite — so
// every authored field goes at once. There is no redacted title beside a
// surviving body. This component therefore replaces a node's ENTIRE content
// region and has no narrower form.
//
// What remains around it is the skeleton, and the skeleton is the point: the
// author, the timestamp, the thread position, the standing, the stance a reader
// can still take. No record leaves the graph, and no removal is silent.
//
// No `error` colouring. A removal is not a failure, and colouring it as one
// editorialises an author's own choice.

export type RemovalReason = "author" | "platform";

const WORDING: Record<RemovalReason, { line: string; detail: string }> = {
  // Removed by choice. Reads as the author's decision, because it is one.
  author: {
    line: "Removed by its author",
    detail: "The post's place in the thread, and every response, remain.",
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

export function RemovedPlaceholder({
  reason,
  when,
  note,
  testId = "removed-placeholder",
}: {
  reason: RemovalReason;
  // Rendered as given: formatting a timestamp is the caller's job, and this
  // component must not invent a locale.
  when?: string;
  note?: string;
  testId?: string;
}) {
  const copy = WORDING[reason];

  return (
    <div
      data-testid={testId}
      data-reason={reason}
      // The same reserved surface an unloaded media tile uses, and for the same
      // reason: this is a space KEPT, not a space lost.
      className="flex flex-col gap-1 rounded-medium bg-surface-container-high p-4"
    >
      <span className="text-body-medium text-on-surface">{copy.line}</span>
      <span className="text-body-small text-on-surface-variant">{note ?? copy.detail}</span>
      {when && <span className="text-label-small text-on-surface-variant">{when}</span>}
    </div>
  );
}

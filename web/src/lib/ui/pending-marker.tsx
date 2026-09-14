// The pending marker (design.md §9 "Honesty surfaces"): content that is
// authored and signed but not yet ordered on L1 shows in full to every
// reader — not just its author — under a quiet line saying it is still
// settling. Nothing is greyed out or held back: the content is real,
// only its place in the order is not, so this never carries `error`
// colouring. The same register as the Edited marker beside it.

export function PendingMarker({
  testId,
  inline = false,
}: {
  testId: string;
  /**
   * The phrasing form, for a marker that lands inside a row which is itself a
   * button — the references sheet's rows (`PendingMarker.jsx`: "a `<button>`
   * takes phrasing content, so a `<p>` inside one is illegal markup"). Same
   * words, same two tokens; only the box changes.
   */
  inline?: boolean;
}) {
  const ink = "text-label-small text-on-surface-variant";
  if (inline) {
    return (
      <span data-testid={testId} className={ink}>
        Still settling
      </span>
    );
  }
  return (
    <p data-testid={testId} className={ink}>
      Still settling
    </p>
  );
}

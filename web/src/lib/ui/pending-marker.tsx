// The pending marker (design.md §9 "Honesty surfaces"): content that is
// authored and signed but not yet ordered on L1 shows in full to every
// reader — not just its author — under a quiet line saying it is still
// settling. Nothing is greyed out or held back: the content is real,
// only its place in the order is not, so this never carries `error`
// colouring. The same register as the Edited marker beside it.

export function PendingMarker({ testId }: { testId: string }) {
  return (
    <p data-testid={testId} className="text-label-small text-on-surface-variant">
      Still settling
    </p>
  );
}

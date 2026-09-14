// AN OPINION ON ONE'S OWN POST IS ONE NUMBER (jakob's ruling,
// 2026-09-14: "the second number isn't yours to set on your own post").
//
// A post always reaches its author in full, so `pInterest` is not a
// value the author picks — it is census-fixed at 1 on a Publish — and a
// pair would draw a second figure nobody chose. The face comes from
// `VALENCE_SIX`, the table built for exactly this reading, and the
// spoken twin names the one axis there is.
//
// The visual is `aria-hidden` and the reading is spoken beside it: an
// emoji's own accessible name is "slightly smiling face", never "Nice",
// so a face alone would take the meaning from exactly the readers
// design.md §10 protects.

import { nearestValenceAnchor, PICK_LABEL, VALENCE_LABEL } from "@/lib/stance/valence";
import { formatDimension } from "@/lib/ui/stance-format";

/** The one-axis reading in words — `Nice, For or against +0.10`. */
export function ownStanceWords(pDirected: number): string {
  return `${nearestValenceAnchor(pDirected).label}, ${VALENCE_LABEL} ${formatDimension(pDirected)}`;
}

/**
 * The face and the one number, as a settings row reads them back
 * (`ComposeSeal`'s "Where you stand on it").
 */
export function OwnStanceReadout({
  pDirected,
  testId,
}: {
  pDirected: number;
  testId: string;
}) {
  const band = nearestValenceAnchor(pDirected);
  return (
    <span className="inline-flex items-baseline gap-1" data-testid={testId}>
      <span aria-hidden="true" className="text-body-medium">
        {band.emoji}
      </span>
      <span aria-hidden="true" className="text-body-small text-on-surface-variant">
        {formatDimension(pDirected)}
      </span>
      <span className="sr-only">{ownStanceWords(pDirected)}</span>
    </span>
  );
}

/**
 * The same reading as the pad's own labelled block: the name of the
 * quantity, then the face and the number on the line below it
 * (`ComposePad.jsx:57-74`, design/backlog.md item 30).
 *
 * The label is drawn but not spoken, exactly as the board draws it: the
 * spoken line is the reading itself, and a screen reader hearing "Your
 * pick" before every drag would hear the label more often than the
 * value.
 */
export function OwnPickBlock({ pDirected, testId }: { pDirected: number; testId: string }) {
  const band = nearestValenceAnchor(pDirected);
  return (
    // Live, because the value changes under a thumb that is covering the
    // knob — the readout is why it sits above the field at all.
    <div className="flex flex-col pr-10" aria-live="polite" data-testid={testId}>
      <span aria-hidden="true" className="text-label-small text-on-surface-variant">
        {PICK_LABEL}
      </span>
      <span aria-hidden="true" className="inline-flex items-baseline gap-2">
        <span className="text-title-large">{band.emoji}</span>
        <span className="text-body-small whitespace-nowrap">{formatDimension(pDirected)}</span>
      </span>
      <span className="sr-only">{ownStanceWords(pDirected)}</span>
    </div>
  );
}

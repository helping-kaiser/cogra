"use client";

// THE PAD PARKS OVER THE PAGE; IT IS NOT A DRAWER.
//
// `ComposePad.jsx:31-47` and the shared `ReplyPadBody` draw the same
// thing: a rounded card inset from both edges and sitting off the bottom,
// over a wash that covers the seal beneath it. design/readme.md
// §"Fixed elements" gives the rule every pad in the product obeys — the
// lower centre of the viewport, the same place every time, because muscle
// memory is part of the control.
//
// A `BottomSheet` gets both halves wrong. It draws a second sheet chrome
// around a control that already has its own (the doubled surface F2-10
// reports), and it parks the pad wherever the drawer happens to stop
// rather than where the thumb learned to find it. Android's reply pad
// already parks (`ReplyWizardScreen.kt`, `PAD_WASH_ALPHA`); this is the
// same parking on web.
//
// It is still a `<dialog>` opened with `showModal()`, which is the
// documented platform answer for "only this is live": the top layer, the
// backdrop that IS the wash, modal focus containment and Escape all come
// from the element rather than from a hand-rolled overlay. What changes
// against `BottomSheet` is where it sits and what it is made of, not how
// it is opened.

import { useEffect, useRef, type ReactNode } from "react";

/**
 * The standoff from the bottom edge, which the two boards draw
 * differently: `ComposePad.jsx` parks at 24px, `ReplyPadBody` at 16.
 * Written as whole classes so the scanner can see them.
 */
const STANDOFF = { compose: "mb-6", reply: "mb-4" } as const;

export function ParkedPad({
  open,
  onClose,
  ariaLabel,
  standoff,
  children,
  testId,
}: {
  open: boolean;
  /** The wash and Escape: both DISMISS, and a dismissal stages nothing. */
  onClose: () => void;
  /**
   * What the pad is announced as. The pad heads itself with its own
   * readout rather than a title row — the board draws no `SheetTitle` —
   * so the name reaches a screen reader here, which is where one asks.
   */
  ariaLabel: string;
  /** Which board's standoff from the bottom edge this pad parks at. */
  standoff: keyof typeof STANDOFF;
  children: ReactNode;
  testId: string;
}) {
  const ref = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      data-testid={testId}
      aria-label={ariaLabel}
      onClose={onClose}
      // A press on the wash drops the pad. It is the same gesture as
      // Cancel — nothing the finger did is committed by leaving.
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      // `mt-auto` parks it at the bottom edge (a dialog is centred by
      // default), the standoff is its board's, and the width is the full
      // page less the board's 30px on each side, capped so the pad stays
      // a thumb-sized instrument on a wide window.
      className={`cg-dialog-in mx-auto mt-auto ${STANDOFF[standoff]} w-[calc(100%-3.75rem)] max-w-[24rem] rounded-extra-large border-0 bg-surface-container-high p-4 text-on-surface backdrop:bg-scrim/50`}
    >
      <div className="flex flex-col gap-3">{children}</div>
    </dialog>
  );
}

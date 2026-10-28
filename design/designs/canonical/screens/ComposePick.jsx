/* THE PICK STEP ON THE PHONE (legacy conversion, the conformance round): the
   device gallery, live — two pictures already picked, the rest of the roll
   waiting, and the way out to the photos app itself in the first cell.

   ABOVE THE TRAY'S HAIRLINE IT IS ITS THREE SIBLINGS TO THE PIXEL, which is
   what `PickTray` exists to guarantee: `ComposePickWeb`, `ComposePickVideo`
   and `ComposePickedErrors` draw the same header, the same prompt and the same
   band, and this board now asks for them the same way. "Show all" comes with
   the tray as a REAL BUTTON (jakob, ruling D) — it was the last inert span on
   the canvas, and the band does not move for it.

   THE GRID IS `PickGrid` (`_shared.jsx`), shared with `ComposePickedErrors`,
   which keeps it under its refusals (seam 245, ask 13 I). It differs from
   `ComposePickVideo`'s dead one in exactly the way the states differ — this
   one takes picks, so its tiles carry selection rings and the picked carry
   their order. */

export function Screen() {
  return (
    <>
      <WizardHeader title="New post" backLabel="Back" />
      <PickPrompt caption="Pick one picture, several, or one video." escapeLabel="Write words instead" />
      <PickTray count={2} onShowAll={() => {}} caption="The first one is the cover.">
        <MediaThumb src="post-photo.jpg" cover onRemove={() => {}} />
        <MediaThumb src="inviter.jpg" onRemove={() => {}} />
      </PickTray>

      <PickGrid rings={[1, 2]} />

      <WizardFooter />
    </>
  );
}

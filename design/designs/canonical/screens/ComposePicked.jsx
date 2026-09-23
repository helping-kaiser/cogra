/* Show all over the pick step (media slice): the per-picture manager —
   reorder (first = cover), remove, describe. The tray behind is `PickTray`,
   the sheet over it `PickedSheet`.

   THE LAST × GIVES THE PICK STEP BACK (jakob's ruling, 2026-09-23). A wizard
   stage never stands on a body that is gone: removing the last picture closes
   the manager and returns the pick step, tray empty — the video path's rule
   ("taking it away gives back the step that takes picks"), applied to the
   picture it always shared a tray with. The stage does NOT become the words
   path (that fork was the author's explicit early choice, and edit's
   body-becomes-words rule exists only because edit has no pick step to give
   back), and the removal is never refused. Title, description, tags and
   references stay staged in the draft, waiting for the body to return. */
const PICKED = [
  { src: "post-photo.jpg", alt: "The coast road", described: true },
  { src: "gallery-market.jpg", alt: "", onDescribe: () => {}, onRemove: () => {} },
  { src: "gallery-honey.jpg", alt: "", onDescribe: () => {}, onRemove: () => {} },
];

export function Screen() {
  return (
    <>
      <WizardHeader title="New post" />
      <PickPrompt caption="Pick one picture, several, or one video." escapeLabel="Write words instead" />
      <PickTray count={3} onShowAll={() => {}}>
        {PICKED.map((item) => (
          <MediaThumb key={item.src} src={item.src} alt={item.alt} />
        ))}
      </PickTray>
      <div style={{ flex: 1 }} />
      <WizardFooter />

      <PickedSheet open items={PICKED} onClose={() => {}} />
    </>
  );
}

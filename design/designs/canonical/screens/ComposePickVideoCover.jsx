/* THE PICK STEP ONCE THE COVER EXISTS (intake 2026-09-15). The wizard is a
   walk that can be walked backwards: from the cover step the back arrow
   returns here — and the tray said nothing about what that step had settled,
   so both client teams read the state as coverless and shipped it that way.

   IT IS ITS OWN BOARD BECAUSE THE TWO STATES CANNOT BOTH BE TRUE, the same
   reason `ComposeCoverPlaying` sits beside `ComposeCover` and
   `ComposeSealUploading` beside `ComposeSeal`. `ComposePickVideo` promises
   "Its cover comes next", which is a sentence only a clip without one can
   carry.

   THE COVER STANDS BESIDE THE CLIP (round 52, jakob 2026-11-17, decision 4;
   his W22: "the cover beeing full size and next to the video … this way we
   also have a entrance gate for changing the cover"). The clip's tile keeps
   frame 0 as its face; the chosen cover stands as its own tile beside it —
   `CoverTile`, at the clip tile's 64 high and the cover's own shape, this
   wide clip's 16:9, so 114 × 64 — wearing the `Cover` pill a post's first
   picture wears. It is the strip's third frame, carrying its own framing.
   The tile is the door, named `Change the cover`: a tap opens the cover
   step with the choice still chosen, as Next does.

   THE CAPTION TAKES THE SETTLED FACT in the space the two tiles leave: the
   promise it carried has been kept. Everything else is `ComposePickVideo`,
   unchanged — the grid is still inert, and the clip's × still gives the
   step back, taking the cover with the clip it belongs to. */
export function Screen() {
  return (
    <>
      <WizardHeader title="New post" backLabel="Back" />
      <PickPrompt escapeLabel="Write words instead" />
      <PickTray count={1} caption="A video is the whole post.">
        <MediaThumb src="post-photo.jpg" alt="" width={114} height={64} video onRemove={() => {}} removeLabel="Remove this video" />
        <CoverTile src="post-photo.jpg" transform="scale(1.5)" width={114} height={64} />
      </PickTray>
      <DeadGrid />
      <WizardFooter />
    </>
  );
}

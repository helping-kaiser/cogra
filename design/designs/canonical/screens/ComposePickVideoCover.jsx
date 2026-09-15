/* THE PICK STEP ONCE THE COVER EXISTS (intake 2026-09-15). The wizard is a
   walk that can be walked backwards: from the cover step the back arrow
   returns here — and the tray said nothing about what that step had settled,
   so both client teams read the state as coverless and shipped it that way.

   IT IS ITS OWN BOARD BECAUSE THE TWO STATES CANNOT BOTH BE TRUE, the same
   reason `ComposeCoverPlaying` sits beside `ComposeCover` and
   `ComposeSealUploading` beside `ComposeSeal`. `ComposePickVideo` promises
   "Its cover comes next", which is a sentence only a clip without one can
   carry.

   THE COVER RIDES THE CLIP'S OWN TILE — `MediaThumb`'s `coverSrc`, the chosen
   frame inset in the bottom-left corner behind a hairline ring. ONE
   ATTACHMENT IS ONE TILE: a cover standing beside the clip would read as a
   second thing the author picked, and they picked one thing. The corner is
   the one the "Cover" badge already owns on a picture, so the tray says cover
   in a single place whatever kind of body is in it.

   THE CAPTION TAKES THE SETTLED FACT in the space the missing controls left:
   the promise it carried has been kept. Everything else is
   `ComposePickVideo`, unchanged — the grid is still inert, and the tile's ×
   still gives the step back, taking the cover with the clip it belongs to. */
export function Screen() {
  return (
    <>
      <WizardHeader title="New post" />
      <PickPrompt caption="Pick one picture, several, or one video." escapeLabel="Write words instead" />
      <PickTray count={1} caption="A video is the whole post. This one has its cover.">
        <MediaThumb
          src="post-photo.jpg"
          alt=""
          width={114}
          height={64}
          video
          coverSrc="post-photo.jpg"
          onRemove={() => {}}
          removeLabel="Remove this video"
        />
      </PickTray>
      <DeadGrid />
      <WizardFooter />
    </>
  );
}

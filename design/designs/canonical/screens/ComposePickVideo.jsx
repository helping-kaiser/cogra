/* The pick step with a clip staged (video conform round, 2026-09-03) — the
   post scale of "a video is the whole body". A post carries pictures OR one
   video, so the moment a clip is in, the step has nothing left to offer: the
   grid stops taking picks and the escape to the photos app goes with it.

   AN ABSENT CONTROL EXPLAINS NOTHING ON ITS OWN (jakob 2026-09-03), so the
   line the tray carries for pictures — "The first one is the cover." — is
   replaced by the one this state needs: "A video is the whole post. Its cover
   comes next." It says why nothing else can join AND what happens next, in
   the space the controls left. Removing the clip (the tile's ×) gives the
   step back.

   NO "Show all": that sheet reorders a set and names its cover. One clip is
   not a set, and its cover is the next step's whole subject.

   WEB TAKES THIS STATE 1:1 — the drop region and the file dialog play the
   grid's part and the staged state is identical, so no web board is drawn
   (the same blessing ComposePickWeb's refusals ride on). */

export function Screen() {
  return (
    <>
      <WizardHeader title="New post" />
      <PickPrompt caption="Pick one picture, several, or one video." escapeLabel="Write words instead" />
      <PickTray count={1} caption="A video is the whole post. Its cover comes next.">
        <MediaThumb src="post-photo.jpg" alt="" width={114} height={64} video onRemove={() => {}} removeLabel="Remove this video" />
      </PickTray>
      <DeadGrid />
      <WizardFooter />
    </>
  );
}

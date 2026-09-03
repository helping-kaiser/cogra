/* THE FULLSCREEN VIEWER, over a clip (readme §13, the reel round). The same
   layer the picture opens into, with the clip's own transport in it: play/pause,
   elapsed, the timeline, duration, and the sound decision — the ladder's top
   rung, and the product's transport rather than the browser's default set.

   PORTRAIT HERE IS THE CLIP WHOLE — the 9:16 frame the card centre-cropped to
   4:5, restored. ROTATING THE DEVICE gives it the screen's whole height (Viewer
   · rotated). Rotation is the device's own gesture, so nothing here draws a
   rotate control.

   The way out is the X, a swipe down, or the backdrop, exactly as for a
   picture. */
export function Screen() {
  const { media, ...post } = MIRA_CLIP_POST;
  return (
    <>
      <DetailHeader items={READER_POST_MENU} />
      <PinnedClip item={media[0]} elapsed="0:14" duration="0:41" progress={0.34} />
      <DetailColumn>
        <PostCard {...post} variant="detail" actions={<ShareButton />} />
      </DetailColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />

      <MediaViewer items={media} index={0} onClose={() => {}} elapsed="0:14" duration="0:41" progress={0.34} />
    </>
  );
}

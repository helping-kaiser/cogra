/* THE FULLSCREEN VIEWER, over a clip (readme §13, the reel round). The same
   black surface the picture opens into, with the clip's own transport on it:
   the big centred play/pause flanked by the skips, and the bar along the
   bottom — elapsed, the timeline, total — held clear of the screen's edge,
   because Android's gesture zone lives there and a control in it is a swipe
   that closes the app.

   PORTRAIT HERE IS THE CLIP WHOLE — the 9:16 frame the card centre-cropped to
   4:5, restored, filling the width. ROTATING THE DEVICE gives it the screen's
   whole height (Viewer · rotated). Rotation is the device's own gesture, so
   nothing here draws a rotate control, and the bar carries no fullscreen toggle
   because this already is it.

   The way out is the X, a swipe down, or the backdrop, exactly as for a
   picture. */
export function Screen() {
  const { media } = MIRA_CLIP_POST;
  return <MediaViewer items={media} index={0} onClose={() => {}} elapsed="0:14" duration="0:41" progress={0.34} />;
}

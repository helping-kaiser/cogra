/* THE VIEWER, ROTATED (readme §13, the reel round). The one board in this canvas
   that is not a portrait phone, because the state it draws is the phone turned:
   the viewer follows the device, and the clip takes the screen's whole height.

   A CLIP WHOSE SHAPE IS NOT THE DEVICE'S IS STILL NOT CUT. This 16:9 clip fills
   the height and leaves ground at the sides — the viewer's one promise is that
   nothing is lost here, and cropping to the edges would break it to win two
   strips of black. That is the opposite of a card, where a clip fills its frame
   and never letterboxes: a card is a layout, and this is the frame itself.

   The chrome is the same chrome — the X, the centred transport, the bar inset
   from the bottom edge. Nothing is added for landscape and nothing taken away,
   and the bar's inset matters more here than anywhere: a rotated phone puts its
   gesture zone along a long edge the thumb rests on. */
export const FRAME = { width: 844, height: 390 };

const CLIP_CANOE = {
  kind: "video",
  src: "clip-canoe.mp4",
  poster: "clip-canoe.jpg",
  ratio: "landscape",
  alt: "Two canoes crossing a mountain lake.",
};

export function Screen() {
  return <MediaViewer items={[CLIP_CANOE]} index={0} onClose={() => {}} elapsed="0:26" duration="1:12" progress={0.36} />;
}

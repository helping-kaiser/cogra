/* THE FULLSCREEN VIEWER, over a picture (readme §13, the reel round). Reached
   by tapping the media AGAIN from the detail view: the card's tap opens the
   post, the post's tap opens the frame.

   IT IS THE WHOLE SCREEN, ON BLACK, WITH NOTHING BEHIND IT. Not a scrim over
   the post — a viewer you can still read a card through is not full screen, and
   the black ground is what makes the frame's own edges the only edges on the
   surface.

   THE FRAME IS NEVER CUT HERE. This is the surface every crop in the product
   exists against — the post's one crop shape, the 4:5 cap, a portrait clip's
   centre-crop — and here the frame is whole: it fills the width at its own
   ratio and takes the ground above and below.

   PINCH TO ZOOM, and the gallery's swipe carries over: the set pages here
   exactly as it does in the card, and the dot row says where in it the reader
   is. Four pictures fit the row's window of seven, so all four stand full size
   here; a longer set slides the window and shrinks the edge dot it is running
   past (`ViewerDots`, item 67). The count itself is spoken, not drawn — the
   row's accessible name reads "Picture 2 of 4".

   NO ACTS AND NO DESCRIPTION. The stance, the count and the share stay on the
   detail view — a viewer that grows a toolbar is a viewer nobody trusts to
   close. The description is read aloud to people who cannot see the frame;
   printed here it would become a caption its author never wrote.

   THREE WAYS OUT: the X, a swipe DOWN, and the backdrop. An X, not a back
   arrow — this is a layer being dismissed, not a step being walked. */
export function Screen() {
  return <MediaViewer items={MIRA_GALLERY_POST.media} index={1} onClose={() => {}} />;
}

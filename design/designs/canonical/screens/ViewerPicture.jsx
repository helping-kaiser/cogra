/* THE FULLSCREEN VIEWER, over a picture (readme §13, the reel round). Reached
   by tapping the media AGAIN from the detail view: the card's tap opens the
   post, the post's tap opens the frame.

   THE FRAME IS NEVER CUT HERE. This is the surface every crop in the product
   exists against — the post's one crop shape, the 4:5 cap, a portrait clip's
   centre-crop — and here the frame is whole, as large as the screen allows.

   PINCH TO ZOOM, and the gallery's swipe carries over: the set pages here
   exactly as it does in the card, and the plain n-of-m says where in it the
   reader is.

   NO ACTS AND NO DESCRIPTION. The stance, the count and the share stay on the
   detail view underneath — a viewer that grows a toolbar is a viewer nobody
   trusts to close. The description is read aloud to people who cannot see the
   frame; printed here it would become a caption its author never wrote.

   THREE WAYS OUT: the X, a swipe DOWN, and the backdrop. An X, not a back
   arrow — this is a layer being dismissed, not a step being walked. */
export function Screen() {
  return (
    <>
      <DetailHeader items={READER_POST_MENU} />
      <DetailColumn>
        <PostCard {...MIRA_GALLERY_POST} variant="detail" actions={<ShareButton />} />
      </DetailColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />

      <MediaViewer items={MIRA_GALLERY_POST.media} index={1} onClose={() => {}} />
    </>
  );
}

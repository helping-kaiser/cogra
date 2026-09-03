/* THE POST, ON ITS OWN (readme §13, the reel round). The surface a search
   result, a chronicle row and a picture's tap have all been opening since the
   canvas was wired, drawn at last: the detail view with nothing over it. The
   comments sheet's board (Comments · the thread) is this screen with the sheet
   raised, which is why the anatomy here is exactly that one's.

   The header owns the one overflow; the card's own dot yields to it. The
   affordance row gains SHARE, after the stance, the score and the count — a
   glyph, no number, one tap to the platform's own sheet.

   Tapping the media here opens the FULLSCREEN VIEWER: on a card the same tap
   opens the post, because a reader scrolling is choosing between posts, but the
   reader who is already here came to look. */
export function Screen() {
  return (
    <>
      <DetailHeader items={READER_POST_MENU} />
      <DetailColumn>
        <PostCard {...MIRA_GALLERY_POST} variant="detail" />
      </DetailColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}

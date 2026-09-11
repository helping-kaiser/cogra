/* The same everyday feed with something waiting in the notifications list — the
   bell's lit state, drawn on the most-seen root so both readings of the band
   exist on the canvas (notifications round, 2026-09-11).

   A DOT AND NEVER A COUNT (jakob). What the shell honestly knows is that
   something arrived; a number turns that into an errand, and the ruling is that
   the bell stays quiet. The dot is `--primary` at 8px, ringed in the surface so
   it reads over the glyph's own silhouette — the badge geometry `ContentRow`
   already uses, at the smallest size that is still a mark.

   ONE MECHANISM, NOT A SECOND BAND. `CograBand`'s `unread` draws it and names
   it: the bell's accessible name changes with the dot, because a marker a
   listener cannot hear is not a marker. Nothing else on the board moves. */
export function Screen() {
  return (
    <>
      <CograBand unread trailing={<FeedFilter />} />
      <FeedList>
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} />
        <PostCard {...TOBIAS_POST} bundle={mkBundle(0.1, 0.1)} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}

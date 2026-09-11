/* THE GRACE STATE, drawn on the feed (readme §13, the account-deletion round;
   jakob's ruling 2026-09-11, mechanics in `docs/instances/erasure.md` §5).

   ONE BOARD DEMONSTRATES A MECHANISM THAT BELONGS TO EVERY SURFACE. The
   confirmed deletion waits out seven days during which NOTHING is redacted, and
   the reader may cancel from any logged-in session — so the state is carried by
   a band on every logged-in screen rather than by a screen of its own. The
   canvas draws it once, on the most-seen root, the way `FeedUnread` draws the
   bell's lit state: the band is the master's, and a board per root would be the
   same drawing seventeen times.

   THE BAND RIDES `CograBand`'s CHILDREN, which is `BorrowedViewBand`'s slot and
   its reason — the non-shrinking top block, so the band collapses and returns
   with the header instead of scrolling out of the reader's life. On an inner
   surface, where the header is `PageHeader`, it sits directly under it. The two
   bands never appear together: a borrowed view belongs to a reader with no
   account of their own, and this one to a reader deleting the account they have.

   THE FEED UNDERNEATH IS UNCHANGED, AND THAT IS THE RULING DRAWN. During the
   grace period nothing is redacted and nothing is withdrawn — the request is a
   pending intent. A feed that started hiding the reader's own posts would be
   redacting early, and would tell them the decision was already taken. */
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />}>
        <DeletionBand days={6} />
      </CograBand>
      <FeedList>
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} />
        <PostCard {...TOBIAS_POST} bundle={mkBundle(0.1, 0.1)} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}

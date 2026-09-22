/* A HISTORIC VERSION, OPENED WHOLE — the post detail's own anatomy, wearing
   the one line that says which version this is (jakob's ruling 2026-09-22: from
   a row you open the historic version's detail view where the kind has one).

   IT IS THE DETAIL SURFACE, NOT A PREVIEW. A version is a complete signed
   record, so the surface that reads one is the surface that reads the post:
   same header, same column, same card at detail size. Anything less would make
   an earlier version look like a lesser artifact than the one on top of it,
   which is exactly backwards — they are the same kind of thing.

   THE BANNER IS A NOTE, AND IT NAMES THE WAY OUT. A reader who came from the
   chronicle knows where they are; this line is for the one who arrived by link.
   It says what this is and hands back the only other place they might have
   meant to be.

   ITS DATE IS WHEN THE VERSION STOPPED STANDING, not when it was signed. The
   card under it already carries the signing date — 8 September, its own
   timestamp — and repeating that above it would tell the reader nothing they
   are not already reading. What they cannot see from the card is how long this
   version was the post, so the banner supplies the other end of it: changed
   away from on 12 September, the date the version above it was signed.

   NO OPINION, NO SCORE, NO COMMENT COUNT. All three are facts about the POST,
   and a version is not the post — drawing them here would offer a reader an
   opinion on one version of something they can only hold one opinion about.
   The comments and the opinions live on the current version's detail, which is
   one tap away through the banner.

   AND NO OVERFLOW. `Removed` settled the shape for a surface with nothing to
   act on — back is the whole header. Edit, Remove and Mark as sensitive all act
   on the post; offering them over a version would invite an author to think
   they are acting on the one they are looking at. */
export function Screen() {
  return (
    <>
      <PageHeader backHref="#" backLabel="Back to the edit history" />
      <HistoricNote line="A historic version — changed 12 September." action="See the current version" />
      <DetailColumn>
        <PostCard {...SALT_MAPS_EARLIER} timestamp="8 September" variant="detail" showStance={false} />
      </DetailColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}

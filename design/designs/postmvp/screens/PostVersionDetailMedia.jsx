/* A HISTORIC PICTURE VERSION, OPENED WHOLE — the 5 September version of the
   salt-maps post, whose body was a picture (jakob's canvas review, 2026-09-23:
   "media posts in detail views look a lot different than text — this should
   not be some janky mix and match stuff but good build screens").

   IT IS CANONICAL'S MEDIA DETAIL, EXACTLY. `PostDetail` draws a picture post
   as the header, the detail column and one `PostCard` at the detail variant —
   the author leading, the title above the picture because it titles the thing,
   the picture running full-bleed to the card's edges and larger than anything
   else on the screen, the description unclamped under it. This board is that
   anatomy with nothing added and nothing moved: a version whose body was a
   picture reads the way a post whose body is a picture reads, and the same tap
   on the picture opens the same fullscreen viewer.

   THE ONE THING IT WEARS IS THE BANNER — `PostVersionDetail`'s panel, the same
   words at this version's other end: it stopped standing on 8 September, when
   the words version above it was signed. Everything else a text version's
   detail says about itself holds here too, and for the same reasons: the tags
   line is the post's current one, and there is no opinion, no score, no comment
   count and no overflow, because each of those is a fact about or an act on the
   POST, never on one of its versions.

   THE FRAME IS 12PX TALLER THAN A PHONE, and only so the card is seen whole: a
   square picture at the detail card's full 390px width, under the banner, runs
   the column to 741px, and the phone's 731 would cut the card's foot by a hair —
   which reads as a drawing error rather than as a scroll. 48 + 741 + 65 = 854,
   drawn at 856. */
export const FRAME = { width: 390, height: 856 };

export function Screen() {
  return (
    <>
      <PageHeader backHref="#" backLabel="Back to the edit history" />
      <DetailColumn>
        <HistoricNote line="A historic version — changed 8 September." action="See the current version" />
        <PostCard {...SALT_MAPS_PICTURE} timestamp="5 September" variant="detail" showStance={false} />
      </DetailColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}

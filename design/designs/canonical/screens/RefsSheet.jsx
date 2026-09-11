/* The tags-and-references sheet (readme §13, 2026-08-28): the card's counts
   open it, and every signed act gets a full row — leading mark, name, and the
   pair the author signed on it. One row shape across every node kind; search
   (backlog item 9) reuses it.

   THIS SHEET IS THE REVEAL, AND THE ONLY ONE (jakob's ruling, the tag round).
   A chip's tap goes to the tag's page on every surface, so there is no
   expanding chip and no second gesture that shows a value: what a node's tags
   are worth is read here, in the list that already exists to hold them.

   THE TWO SECTIONS COUNT IN DIFFERENT UNITS, and the rows say so. A tag's
   confidence is census-bounded to [0, 1] (hashtag.md §4), so it wears no sign
   — `+0.40 / 0.90`. A reference's second axis is enthusiasm over [-1, +1]
   (`ReferenceInput`, api-spec.md), so it keeps one. `formatTagPair` is where
   the difference is assigned.

   AND THIS SHEET IS WHERE "STILL SETTLING" SHOWS (jakob's ruling, 2026-09-10).
   The chip on the card says nothing about an act still finding its place in the
   order — a tag's word is the tag's word either way — so the honesty lands here,
   on the row that already carries the act's own numbers. Two rows wear it, one
   per section: a settling tag and a settling citation are the same fact about
   two families, and a sheet that drew it on only one would imply the other
   cannot.

   THE COUNT IS THE LIST'S LENGTH (jakob's ruling, 2026-09-10). A reference
   counts whatever kind of node it points at — a chat message is cited exactly
   as a post is — so the card's number and the rows under References are the
   same ten. A count that quietly dropped a kind would tell a reader the sheet
   holds less than it does, and this sheet is the only place the number can be
   checked. */
export function Screen() {
  return (
    <>
      <DetailHeader items={READER_POST_MENU} />
      <DetailColumn>
        <PostCard {...ADA_POST} variant="detail" references={10} />
      </DetailColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />

      <BottomSheet open ariaLabel="Tags and references" maxHeight="88%">
        <SheetTitle>Tags &amp; references</SheetTitle>
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <SectionLabel>Tags</SectionLabel>
          <ReferenceRow kind="topic" name="photography" pair={{ pDirected: 0.4, pInterest: 0.9 }} onOpen={() => {}} />
          <ReferenceRow kind="topic" name="coastroad" pair={{ pDirected: 0.1, pInterest: 1 }} pending onOpen={() => {}} />
          <SectionLabel>References</SectionLabel>
          <ReferenceRow kind="person" name="Mira Voss" src="inviter.jpg" pair={{ pDirected: 0.1, pInterest: 0.1 }} onOpen={() => {}} />
          <ReferenceRow kind="post" name="Salt maps of the coast road" src="post-photo.jpg" pair={{ pDirected: 0.55, pInterest: 0.2 }} onOpen={() => {}} />
          <ReferenceRow kind="post" name="Low tide at six tomorrow — anyone walking the flats?" pair={{ pDirected: 0.1, pInterest: 0.1 }} onOpen={() => {}} />
          <ReferenceRow kind="comment" name="That stretch after the second bend…" pair={{ pDirected: 0.1, pInterest: 0.1 }} onOpen={() => {}} />
          <ReferenceRow kind="proposal" name="Mark the flooded dip on the coast road" pair={{ pDirected: 0.25, pInterest: 0.15 }} onOpen={() => {}} />
          <ReferenceRow kind="item" name="Salt-crust rubbing, framed" pair={{ pDirected: 0.1, pInterest: 0.1 }} onOpen={() => {}} />
          <ReferenceRow kind="campaign" name="Coast road cleanup week" pair={{ pDirected: 0.4, pInterest: 0.4 }} onOpen={() => {}} />
          <ReferenceRow kind="offer" name="Offer on: Salt-crust rubbing, framed" pair={{ pDirected: 0.1, pInterest: 0.1 }} onOpen={() => {}} />
          <ReferenceRow kind="chat" name="Coast walkers" pair={{ pDirected: 0.1, pInterest: 0.1 }} onOpen={() => {}} />
          <ReferenceRow kind="message" name="Crust held all the way past the slipway today." sub="in Coast walkers" pair={{ pDirected: 0.1, pInterest: 0.1 }} pending onOpen={() => {}} />
        </div>
      </BottomSheet>
    </>
  );
}

/* Explore, searching — an @-scoped query. The band has given way to the field;
   ONE trigger reads the view back in words (the FeedFilter idiom) beside the
   screen's one "?"; ranked rows carry the graph glyph, the seam marks where
   ranking ends, and the tail carries ages. The comment, the tag and the offer
   are INDIRECT hits — found through their target's name, said on the second
   line.

   THE TAG IS A RESULT KIND (readme §13, the tag round). `FEED_KINDS` has
   admitted it since the filter's one list, and Hashtag `name` is an indexed
   field in the global index (api-spec.md, "What is indexed"), so a search that
   could not return one was a gap in the drawing rather than in the contract.
   Its mark is the same `#` tile its chip and its sheet row wear.

   ITS EDGE IS A RANK, NOT A USE COUNT (jakob's ruling). Every other kind on
   this board carries a viewer-relative rank and a tag is a kind; a global
   "12k posts" would be nobody's view in particular and unexplainable, which
   §3 refuses. It ships when 2.7's index and slice 3's ranker are both in —
   the same staging the Sky's entry carries.

   IT IS DRAWN INDIRECT, AND THAT READING IS FLAGGED. A Type is authored by
   nobody, so it is not @sol's content; it is here as the target of an act of
   theirs, which is the same route the comment takes through its post's title
   (§13's scope operators: "the names of their acts' targets"). Whether an
   @-scope returns the Type itself or only the content tagged with it is not
   settled anywhere, so the second line says the route out loud rather than
   letting the row imply an answer. */
export function Screen() {
  return (
    <>
      <div style={{ flex: "none", paddingTop: 12 }}>
        <SearchBar query="@sol salt" />
        <SearchTriggerRow reading="Everything" />
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <ReferenceRow kind="post" name="Salt maps of the coast road" src="post-photo.jpg" rank="9.10" onOpen={() => {}} />
        <ReferenceRow kind="item" name="Salt-crust rubbing, framed" rank="4.30" onOpen={() => {}} />
        <ReferenceRow kind="topic" name="saltmaps" sub="tagged by @sol" rank="3.40" onOpen={() => {}} />
        <ReferenceRow kind="comment" name="The wax-stick ones read like weather charts…" sub="on Salt flats at first light" rank="2.10" onOpen={() => {}} />
        <ReferenceRow kind="message" name="Crust held all the way past the slipway today." sub="in Coast walkers" rank="1.80" onOpen={() => {}} />
        <Seam />
        <ReferenceRow kind="offer" name="An offer by @sol" sub="on Salt shaker, glazed ceramic" value="2d" onOpen={() => {}} />
        <ReferenceRow kind="post" name="First try at a rubbing" value="06.09.2024" onOpen={() => {}} />
      </div>
      <BottomNav active="search" slots={ALL_SLOTS} inline />
    </>
  );
}

/* Explore, searching — an @-scoped query. The band has given way to the field;
   ONE trigger reads the view back in words (the FeedFilter idiom) beside the
   screen's one "?"; ranked rows carry the graph glyph, the seam marks where
   ranking ends, and the tail carries ages. The comment and the offer are
   INDIRECT hits — found through their target's name, said on the second
   line. */
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

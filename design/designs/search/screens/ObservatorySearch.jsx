/* Direction 1 · The observatory, searching — an @-scoped query. Chips row for
   kinds, the order controls beneath, ranked rows with the seam and the aged
   tail. The comment and the offer are INDIRECT hits: found through their
   target's name, said on the second line. */
export function Screen() {
  return (
    <>
      <CograBand>
        <SearchBar query="@sol salt" />
      </CograBand>
      <KindsRow active="All" />
      <OrderRow order="ranked" hideSeen={false} />
      <Column>
        <ReferenceRow kind="post" name="Salt maps of the coast road" src="post-photo.jpg" value="9.10" onOpen={() => {}} />
        <ReferenceRow kind="item" name="Salt-crust rubbing, framed" value="4.30" onOpen={() => {}} />
        <ReferenceRow kind="comment" name="The wax-stick ones read like weather charts…" sub="on Salt flats at first light" value="2.10" onOpen={() => {}} />
        <Seam />
        <ReferenceRow kind="offer" name="An offer by @sol" sub="on Salt shaker, glazed ceramic" value="2d" onOpen={() => {}} />
        <ReferenceRow kind="chat" name="Crust held all the way past the slipway today." sub="in Coast walkers" value="1w" onOpen={() => {}} />
      </Column>
      <BottomNav active="search" slots={ALL_SLOTS} inline />
    </>
  );
}

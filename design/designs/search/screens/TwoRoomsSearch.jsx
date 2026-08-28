/* Direction 3 · Two rooms, searching — a plain query, and the results arrive
   SECTIONED BY KIND instead of filtered by chips: every kind announces itself,
   the order controls stay one row. */
export function Screen() {
  return (
    <>
      <CograBand>
        <SearchBar query="salt" />
      </CograBand>
      <OrderRow order="ranked" hideSeen={false} />
      <Column>
        <SectionLabel>People</SectionLabel>
        <ReferenceRow kind="person" name="Sal Torres" value="6.10" onOpen={() => {}} />
        <SectionLabel>Topics</SectionLabel>
        <ReferenceRow kind="topic" name="saltmaps" value="12.40" onOpen={() => {}} />
        <SectionLabel>Posts</SectionLabel>
        <ReferenceRow kind="post" name="Salt maps of the coast road" src="post-photo.jpg" value="9.10" onOpen={() => {}} />
        <ReferenceRow kind="post" name="Salt flats at first light" value="5.60" onOpen={() => {}} />
        <SectionLabel>Items</SectionLabel>
        <ReferenceRow kind="item" name="Salt-crust rubbing, framed" value="4.30" onOpen={() => {}} />
        <Seam />
        <ReferenceRow kind="post" name="Grain of the flats" value="3w" onOpen={() => {}} />
      </Column>
      <BottomNav active="search" slots={ALL_SLOTS} inline />
    </>
  );
}

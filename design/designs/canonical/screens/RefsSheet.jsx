/* The topics-and-references sheet (readme §13, 2026-08-28): the card's counts
   open it, and every signed act gets a full row — leading mark, name, and the
   pair the author signed on it. One row shape across every node kind; search
   (backlog item 9) reuses it. */
export function Screen() {
  return (
    <>
      <DetailHeader items={READER_POST_MENU} />
      <DetailColumn>
        <PostCard {...ADA_POST} variant="detail" references={9} />
      </DetailColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />

      <BottomSheet open ariaLabel="Topics and references" maxHeight="88%">
        <SheetTitle>Topics &amp; references</SheetTitle>
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <SectionLabel>Topics</SectionLabel>
          <ReferenceRow kind="topic" name="photography" pair="+0.40 / +0.20" onOpen={() => {}} />
          <ReferenceRow kind="topic" name="coastroad" pair="+0.10 / +0.10" onOpen={() => {}} />
          <SectionLabel>References</SectionLabel>
          <ReferenceRow kind="person" name="Mira Voss" src="inviter.jpg" pair="+0.10 / +0.10" onOpen={() => {}} />
          <ReferenceRow kind="post" name="Salt maps of the coast road" src="post-photo.jpg" pair="+0.55 / +0.20" onOpen={() => {}} />
          <ReferenceRow kind="post" name="Low tide at six tomorrow — anyone walking the flats?" pair="+0.10 / +0.10" onOpen={() => {}} />
          <ReferenceRow kind="comment" name="That stretch after the second bend…" pair="+0.10 / +0.10" onOpen={() => {}} />
          <ReferenceRow kind="proposal" name="Mark the flooded dip on the coast road" pair="+0.25 / +0.15" onOpen={() => {}} />
          <ReferenceRow kind="item" name="Salt-crust rubbing, framed" pair="+0.10 / +0.10" onOpen={() => {}} />
          <ReferenceRow kind="campaign" name="Coast road cleanup week" pair="+0.40 / +0.40" onOpen={() => {}} />
          <ReferenceRow kind="offer" name="Offer on: Salt-crust rubbing, framed" pair="+0.10 / +0.10" onOpen={() => {}} />
          <ReferenceRow kind="chat" name="Coast walkers" pair="+0.10 / +0.10" onOpen={() => {}} />
          <ReferenceRow kind="message" name="Crust held all the way past the slipway today." sub="in Coast walkers" pair="+0.10 / +0.10" onOpen={() => {}} />
        </div>
      </BottomSheet>
    </>
  );
}

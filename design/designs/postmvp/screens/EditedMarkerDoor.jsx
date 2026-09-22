/* THE EDITED MARKER, TAPPABLE — the second door onto a history, and the one a
   reader finds without looking for it (jakob's ruling 2026-09-22).

   THE MARKER WAS ALWAYS THE HONEST PLACE FOR THIS. It is already the product
   saying "this changed"; a reader who reads that word and wants to know what it
   means is exactly the reader the history was drawn for. Leaving the only door
   in a ⋮ would hide the answer one layer behind the question.

   THE COMPONENT ALREADY HELD THE SLOT. `EditedMarker` has carried an unused
   `onInspect` since the honesty markers were drawn — handed one it renders the
   underlined form, handed nothing it stays a plain line. So this round wires
   the slot rather than changing the marker: the same two tokens, the same word,
   and the underline is the whole difference between a statement and a door.

   IT AND THE ⋮ ROW APPEAR TOGETHER, under one condition — a second version
   exists. A post with one version wears neither; a post with two wears both.
   Two doors onto one surface is not a duplication here: one is where a reader
   already is, the other is where a reader goes looking. */
export function Screen() {
  return (
    <>
      <DetailHeader items={OWN_POST_MENU} />
      <DetailColumn>
        <PostCard {...SALT_MAPS_CURRENT} timestamp="12 September" variant="detail" edited onInspectEdit={() => {}} score="9.10" comments={2} />
      </DetailColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}

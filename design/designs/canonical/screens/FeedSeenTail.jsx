/* THE FEED, PAST WHAT IS NEW — THE SEEN TAIL (jakob 2026-10-14, round 11).
   At the foot of the unseen rows a quiet separator stands, `Already seen`, and
   what the reader has already seen continues beneath it, in the order the
   filter sets — Ranked here, so the tail is ranked too; under Newest it reads
   by time.

   WHY IT EXISTS: A SPARSE NETWORK. Early on, a reader's reach holds one new
   post on a good morning, and a feed that ends after it reads as a product
   with nothing in it. The tail gives the feed more to it than the one new
   post without pretending the old ones are new: the separator says where new
   ends, and nothing under it is dressed as anything but what it is.

   ONLY THE SEEN CUT LIFTS. Every other cut the filter makes holds beneath the
   separator as above it — the kinds, the kinds of post, the topic, the people
   row, Still settling, Sensitive and Removed — and a hidden person's rows stay
   out of the tail as they stay out of the feed. Scrolling or reading the tail
   records nothing: the rows are seen already.

   THE SEPARATOR IS EXPLORE'S SEAM (`Seam`), with the feed's own words: the
   hairline and the centred label-small line the system already draws where a
   list changes what it is listing. No new construction. Nothing on a seen
   card marks it seen — the separator alone says it, and a per-card mark is
   not ruled.

   TWO STATES, ONE BOARD (the `unseen` chip). `one`: Tobias's post is the one
   new row, then the separator, then Ada's and Sol's, seen, in rank order —
   the sparse morning the tail exists for. `none`: nothing is unseen, so the
   feed opens at the separator with the tail beneath it — the moment that was
   the empty feed. The unseen card hides under `none` and is drawn once, so
   it is no duplicate.

   AN EXEMPLAR OF `Feed`'s SHELL (the pattern-exemplar rule): only the
   separator is its own, and it carries no control; the band, the cards and
   the nav are wired on `Feed`.

   REGISTERED under the `feed` prefix, named as `Feed` names the page; the
   separator is `seenSeparator`, its words `label`. */
export const NODE = "feed";
export const PROPS = { unseen: { editor: "enum", options: ["one", "none"], default: "one" } };
export const VALS = `unseenShown: this.props.unseen === "none" ? "none" : "flex"`;

export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter node="filterTrigger" />} node="band" />
      <FeedList>
        <div style={{ display: "{{unseenShown}}", flexDirection: "column" }}>
          <PostCard {...TOBIAS_POST} bundle={mkBundle(0.1, 0.1)} node="card" />
        </div>
        <Seam node="seenSeparator">Already seen</Seam>
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} node="card" />
        <PostCard {...SOL_POST} bundle={mkBundle(0.3, 0.45)} node="card" />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />
    </>
  );
}

/* Explore, searching — an @-scoped query. The band has given way to the field;
   ONE trigger reads the view back in words (the FeedFilter idiom) beside the
   screen's one "?"; ranked rows carry the graph glyph, the seam marks where
   ranking ends, and the tail carries ages. The comment and the tag are
   INDIRECT hits — found through their target's name, said on the second
   line.

   THE ROWS ARE V1.0'S KINDS (readme §13, the V1.0 scope cut, 2026-09-25):
   search returns no item, offer or message rows in V1.0, so every row here
   is a post, a comment or a tag, and each opens a drawn board.

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
   letting the row imply an answer.

   UNDER NEWEST THE SAME RESULTS READ BY TIME (jakob 2026-10-07, ruling 24;
   the search packet's SG-5 — the `order` chip's `newest`). The order is one
   of the filter's two (`OrderSection`), and Newest is also what the search
   serves before the ranker exists, so it is drawn as this board's state
   rather than as a board of its own. With nothing ranked there is NO SEAM:
   a seam on top would call every row "beyond your reach", a label that lies.
   Full matches still lead — the tiers are the query's, not the ranker's —
   and inside each tier the newest stands first; these four are all partial
   matches, so time alone orders them here. Every row carries its age on the
   VALUE edge, the one the rows past the seam already use, in copy-voice's
   one ladder (`2h`, `3d`, then the date). A TAG ROW STANDS BARE: a Type has
   nothing to date and its rank is the ranker's, so its edge carries nothing,
   never a use count; it keeps its place by when the tag first stood. The
   trigger still reads `Everything` — Newest here is the reader's own
   default, or the interim's, and the trigger speaks only deviations. When
   the split ships with the ranker is the implementation's sequencing.

   REGISTERED under the `explore` prefix (design ⇄ impl seam 062/063), named
   as `Explore` names the field. Each row is a `result`, keyed by its position
   in the results — two results can share a name, and the order is the
   search's own claim — counting on past the `seam`. The `order` chip draws
   the results twice, one shown at a time (jakob 2026-10-06, seam 069 — a
   chip-drawn state duplicate): each `result` sits directly in its copy and
   keeps its own key, its position under that order (jakob 2026-10-07, ruling
   39). The `seam` is drawn once, under `ranked` alone, so it is no duplicate
   and keeps its unkeyed path: it stands between the ranked copy's two halves
   and simply hides under `newest`. */
export const NODE = "explore";
export const PROPS = { order: { editor: "enum", options: ["ranked", "newest"], default: "ranked" } };
export const VALS = `rankedShown: this.props.order === "newest" ? "none" : "flex", newestShown: this.props.order === "newest" ? "flex" : "none"`;

export function Screen() {
  return (
    <>
      <div style={{ flex: "none", paddingTop: 12 }}>
        <SearchBar query="@sol salt" node="searchField" />
        <SearchTriggerRow reading="Everything" />
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "{{rankedShown}}", flexDirection: "column" }} data-node-chip="order" data-node-key="ranked">
          <ReferenceRow kind="post" name="Salt maps of the coast road" src="post-photo.jpg" rank="9.10" onOpen={() => {}} node="result" nodeKey="1" />
          <ReferenceRow kind="topic" name="saltmaps" sub="tagged by @sol" rank="3.40" onOpen={() => {}} node="result" nodeKey="2" />
          <ReferenceRow
            kind="comment"
            name="The wax-stick ones read like weather charts…"
            sub="on Salt flats at first light"
            rank="2.10"
            onOpen={() => {}}
            node="result"
            nodeKey="3"
          />
        </div>
        <div style={{ display: "{{rankedShown}}", flexDirection: "column" }}>
          <Seam node="seam" />
        </div>
        <div style={{ display: "{{rankedShown}}", flexDirection: "column" }} data-node-chip="order" data-node-key="ranked">
          <ReferenceRow kind="post" name="First try at a rubbing" value="06.09.2024" onOpen={() => {}} node="result" nodeKey="4" />
        </div>
        <div style={{ display: "{{newestShown}}", flexDirection: "column" }} data-node-chip="order" data-node-key="newest">
          <ReferenceRow
            kind="comment"
            name="The wax-stick ones read like weather charts…"
            sub="on Salt flats at first light"
            value="2h"
            onOpen={() => {}}
            node="result"
            nodeKey="1"
          />
          <ReferenceRow kind="post" name="Salt maps of the coast road" src="post-photo.jpg" value="3d" onOpen={() => {}} node="result" nodeKey="2" />
          <ReferenceRow kind="topic" name="saltmaps" sub="tagged by @sol" onOpen={() => {}} node="result" nodeKey="3" />
          <ReferenceRow kind="post" name="First try at a rubbing" value="06.09.2024" onOpen={() => {}} node="result" nodeKey="4" />
        </div>
      </div>
      <BottomNav active="search" slots={ALL_SLOTS} inline node="bottomBar" />
    </>
  );
}

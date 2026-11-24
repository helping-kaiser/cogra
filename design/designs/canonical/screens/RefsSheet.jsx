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
   counts whatever kind of node it points at — a comment is cited exactly as a
   post is — so the card's number and the rows under References are the same
   four. A count that quietly dropped a kind would tell a reader the sheet
   holds less than it does, and this sheet is the only place the number can be
   checked.

   A V1.0 REFERENCE POINTS AT A PERSON, A POST OR A COMMENT (readme §13, the
   V1.0 scope cut, 2026-09-25 — the contract's `ReferenceTarget` union, read
   as the ruling). So those are the rows, and each opens its own board: a
   person their profile, a post its detail, a comment its thread. The settling
   citation rides the comment row, the section's last.

   A REMOVED OR DELETED THING IS NEVER NAMED (round 61; the pointer rule
   blessed 2026-11-19) — the `target` chip: `removed` the salt maps, removed by
   its author, its row the removal mark in the name's place, the tile empty,
   the row inert (`ReferenceRow`'s `removed`, seam 248; `StagedReference`'s
   face); `deleted` Mira's account gone, the reserved disc and `Deleted
   account` in the name's place, the row still the door to the account's
   page. A deleted account's post still there keeps its title, as any post's
   row — this row prints no author — and a swept one reads as `removed`.

   REGISTERED under the `postDetail` prefix (round 62; jakob 2026-11-23, B5
   (a)), as `CitedBy` registers its sheet: the detail beneath as `PostDetail`
   names it, the sheet `refsSheet` and its `title`, each tag row a `tag` keyed
   by the tag's name, each reference row a `reference` keyed by its place in
   the References section — the `target` chip's copies one row in two states.
   The comment's own sheet over the thread (`CommentRefsSheet`) takes the same
   paths, told apart by board. */
export const NODE = "postDetail";
export const PROPS = { target: { editor: "enum", options: ["live", "removed", "deleted"], default: "live" } };
export const VALS = `personLive: this.props.target === "deleted" ? "none" : "contents", personDeleted: this.props.target === "deleted" ? "contents" : "none", postLive: this.props.target === "removed" ? "none" : "contents", postRemoved: this.props.target === "removed" ? "contents" : "none"`;
export function Screen() {
  return (
    <>
      <DetailHeader items={READER_POST_MENU} node="header" />
      <DetailColumn>
        <PostCard {...ADA_POST} variant="detail" references={4} node="card" />
      </DetailColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />

      <BottomSheet open ariaLabel="Tags and references" maxHeight="88%" node="refsSheet">
        <SheetTitle node="title">Tags &amp; references</SheetTitle>
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <SectionLabel>Tags</SectionLabel>
          <ReferenceRow kind="topic" name="photography" pair={{ pDirected: 0.4, pInterest: 0.9 }} onOpen={() => {}} node="tag" nodeKey="photography" />
          <ReferenceRow kind="topic" name="coastroad" pair={{ pDirected: 0.1, pInterest: 1 }} pending onOpen={() => {}} node="tag" nodeKey="coastroad" />
          <SectionLabel>References</SectionLabel>
          <div style={{ display: "{{personLive}}" }} data-node-chip="target" data-node-key="live">
            <ReferenceRow kind="person" name="Mira Voss" src="inviter.jpg" pair={{ pDirected: 0.1, pInterest: 0.1 }} onOpen={() => {}} node="reference" nodeKey="1" />
          </div>
          <div style={{ display: "{{personDeleted}}" }} data-node-chip="target" data-node-key="deleted">
            <ReferenceRow kind="person" name="Mira Voss" src="inviter.jpg" redacted pair={{ pDirected: 0.1, pInterest: 0.1 }} onOpen={() => {}} node="reference" nodeKey="1" />
          </div>
          <div style={{ display: "{{postLive}}" }} data-node-chip="target" data-node-key="live">
            <ReferenceRow kind="post" name="Salt maps of the coast road" src="post-photo.jpg" pair={{ pDirected: 0.55, pInterest: 0.2 }} onOpen={() => {}} node="reference" nodeKey="2" />
          </div>
          <div style={{ display: "{{postRemoved}}" }} data-node-chip="target" data-node-key="removed">
            <ReferenceRow kind="post" name="Salt maps of the coast road" src="post-photo.jpg" removed="Removed by its author" redacted pair={{ pDirected: 0.55, pInterest: 0.2 }} node="reference" nodeKey="2" />
          </div>
          <ReferenceRow kind="post" name="Low tide at six tomorrow — anyone walking the flats?" pair={{ pDirected: 0.1, pInterest: 0.1 }} onOpen={() => {}} node="reference" nodeKey="3" />
          <ReferenceRow kind="comment" name="That stretch after the second bend…" pair={{ pDirected: 0.1, pInterest: 0.1 }} pending onOpen={() => {}} node="reference" nodeKey="4" />
        </div>
      </BottomSheet>
    </>
  );
}

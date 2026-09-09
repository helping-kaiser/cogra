/* THE TAG PAGE (readme §13, the tag round; ruled 2026-09-01, drawn
   2026-09-09). What every `#chip` on every surface opens — the one destination
   a tag has. Both apps have shipped it since slice 2.3 and the canvas had
   never drawn it, which is the debt this board pays.

   IT IS A SUBPAGE OF SEARCH, so the arrow is a LINK back to Explore rather
   than history, and there is NO BOTTOM BAR — the settings round's rule for a
   surface a reader arrives at, reads, and leaves. A tag is not a fifth tab.

   THE TITLE IS THE TAG, HASH AND ALL. The `#` is part of the word everywhere
   in this system (`TopicChip`), and a page titled `saltmaps` would be the one
   place it is not.

   THE FOLLOW CONTROL IS THE STANCE CONTROL, because following a tag IS a
   stance: hashtag.md §3 makes it an **Affinity** record, Actor → Type, and
   api-spec.md's `viewerStance` on `Hashtag` is "the follow control's read"
   with `prepareStance` as its write. Its two parameters are signed over
   [-1, +1] like every other stance, so the pad fits it exactly — a second,
   toggle-shaped gesture for a record family this system already has a control
   for would hide that following is a signed, priced act.

   AND IT IS DRAWN AS THE END STATE, WITH THE OBLIGATION NAMED. The roadmap is
   explicit: "Topic follow is backend-accepted but client-hidden until the
   topic feed lands (slice 3)". The canvas draws the destination; the register
   carries the obligation — the same split the feed's filter keeps, where the
   drawn default is `Ranked` and the shipped label reads Newest until the
   ranker ships. Implementation cannot read this control as permission to ship
   it before slice 3.

   NO ORDER CONTROL, AND THAT IS THE CONTRACT (jakob's ruling). `taggedContent`
   is `(limit: Int)` returning a plain list, newest claim first, and the schema
   says why in its own docstring: "a Relay connection would promise a
   pagination the read cannot honour". A Ranked/Newest swap would promise an
   ordering the field cannot serve either, and the search rulings' order
   section is a control this page has no right to. In the end state the ranker
   orders this list (slice 3) — that is a staging note, not a control, and
   nothing on the board offers the reader a choice about it.

   SO THERE IS NO PAGINATION AND NO LOAD-MORE, for the same sentence. The list
   is limit-bounded and the board draws it ending, not trailing off into a
   spinner that would lie about what comes next.

   THE LIST IS MIXED, AND EACH KIND KEEPS ITS OWN MASTER. A tagged post is a
   post card; a tagged comment is `CommentCard` in the out-of-thread shape
   `ProfileComments` already draws, leading with the thread it answers, because
   a comment met away from its thread has to say what it is answering. Neither
   is redrawn here.

   WHAT THE LIST SERVES IS THE AUTHOR'S OWN CLAIMS, and 2.3 could not serve
   more: `taggedContent` reads "the content-intrinsic channel: claims whose
   author is the content's own author". A stranger's tag reaches a viewer only
   through the tagger at a weight slice 3 computes, so third-party claims join
   this page with the ranker, not before.

   THE PAIR IS ON EVERY ROW, PLAINLY (`TaggedRow`) — a signed act is public
   record. Relevance is signed, confidence is not, because the census bounds
   them differently.

   THE REFERENCES TAKEN, and what was refused: Mastodon's hashtag page gives
   the shape — the tag as the title, the follow control on the header's
   trailing edge, a plain chronological column of whole posts. Its "N people
   talking" figure is refused: a global popularity count is exactly the badge
   farming §3 rules out, and every number this product shows has to be the
   viewer's own and explainable. Instagram's tag page agrees with us about
   having no order switcher and for the opposite reason — it curates
   algorithmically, which is the one thing this product cannot do — and its
   media grid is refused because this list is not all media. X's Top / Latest /
   People tabs are refused twice over: a segmented row of tiers the contract
   cannot serve, on a page that would then just be search again. Tumblr's
   "post this tag" button is a compose entrance nothing has ruled, so it is not
   invented here. */
export function Screen() {
  return (
    <>
      <PageHeader
        title="#saltmaps"
        backHref="#"
        backLabel="Back to Explore"
        action={<StanceControl targetLabel="this tag" bundle={mkBundle(0.4, 0.3)} onCommit={() => {}} />}
      />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 8, padding: "4px 0 0" }}>
        <QuietNote>Everything its author tagged #saltmaps, newest first.</QuietNote>

        <TaggedRow pair="+0.55 / 1.00">
          <PostCard {...SOL_POST} bundle={mkBundle(0.1, 0.1)} />
        </TaggedRow>

        <TaggedRow pair="+0.40 / 0.90">
          <CommentCard
            author={ADA}
            content="Low tide is kinder to the rubbings than noon ever was."
            timestamp="4d"
            license={{ attribution: 0, provenance: 0 }}
            bundle={mkBundle(0.1, 0.1)}
            replyCount={2}
            onOpenReplies={() => {}}
            onReply={() => {}}
            target="“Salt maps of the coast road” — @sol"
            onOpenTarget={() => {}}
          />
        </TaggedRow>

        <TaggedRow pair="+0.10 / 1.00" pending>
          <PostCard {...TOBIAS_POST} bundle={mkBundle(0.1, 0.1)} />
        </TaggedRow>
      </div>
    </>
  );
}

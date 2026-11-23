/* THE TAG PAGE (readme §13, the tag round; ruled 2026-09-01, drawn
   2026-09-09; the stance row added by the topic round, 2026-09-14). What every
   `#chip` on every surface opens — the one destination a tag has. Both apps
   have shipped it since slice 2.3 and the canvas had never drawn it, which is
   the debt this board pays.

   IT IS A SUBPAGE OF SEARCH, and there is NO BOTTOM BAR — the settings round's
   rule for a surface a reader arrives at, reads, and leaves. A tag is not a
   fifth tab.

   THE ARROW IS HISTORY, AND THE LABEL NAMES THE ORIGIN (jakob 2026-09-15):
   `Back to Explore` from Explore, `Back to Your tags` from the list, `Back to
   feed` from a feed chip. A cold entry with no history — a shared URL — falls
   back to `Back to Explore`, which is the state this board draws.

   THE TITLE IS THE TAG, HASH AND ALL. The `#` is part of the word everywhere
   in this system (`TopicChip`), and a page titled `saltmaps` would be the one
   place it is not.

   THE HEADER STILL CARRIES NO CONTROL, AND THE ROW BELOW IT DOES (jakob's
   review 2026-09-09, closed by the topic round 2026-09-14). A stance anchor on
   the header's trailing edge read as a stance readout for the post the reader
   arrived from; a row of its own, under the title and above anything belonging
   to a post, cannot. THE GESTURE IS AN AFFINITY — Actor → Type, both
   parameters signed, bundling NET, and a walk-back to nothing is the same
   priced severance every other stance's is. There is no toggle and no one-tap
   follow, because this product has no such gesture to offer: taking a position
   on a topic is taking a position, at the same price and through the same
   ceremony. The anatomy lives on `TagPageBody`; this board is the page with
   nothing held, and `TagPageHeld` the page with something.

   THE WORD "FOLLOW" IS NOT ON THE SCREEN, and will not be (copy-voice's ban,
   extended to topics 2026-09-14). The list of what a reader holds is "Your
   topics", in Explore.

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
   is redrawn here. THE COMMENT OFFERS NO REPLY AFFORDANCES (jakob's review):
   on this page a card is a doorway — its thread is reached through the post —
   so there is no Reply and no view-replies line to promise conversation in a
   place that only lists.

   WHAT THE LIST SERVES IS THE AUTHOR'S OWN CLAIMS, and 2.3 could not serve
   more: `taggedContent` reads "the content-intrinsic channel: claims whose
   author is the content's own author". A stranger's tag reaches a viewer only
   through the tagger at a weight slice 3 computes, so third-party claims join
   this page with the ranker, not before.

   THE CLAIM IS ON EVERY ROW, PLAINLY (`TaggedRow`) — a signed act is public
   record. The tag table's glyph carries the reading; the exact pair sits with
   it and paints in geek mode, relevance signed and confidence not, because the
   census bounds them differently.

   AND IT IS DRAWN WHOLE, for `Settings`' reason. What this board records is a
   LIST — its order, its two kinds, the claim above each row — and a list cut
   off at 844px is a list nobody can review: the comment, which is the whole
   point of saying the list is mixed, would be the half-row under the fold. The
   frame is the state the board draws.

   THE REFERENCES TAKEN, and what was refused: Mastodon's hashtag page gives
   the shape — the tag as the title, a plain chronological column of whole
   posts (its header follow was taken too, then removed at review). Its "N people
   talking" figure is refused: a global popularity count is exactly the badge
   farming §3 rules out, and every number this product shows has to be the
   viewer's own and explainable. Instagram's tag page agrees with us about
   having no order switcher and for the opposite reason — it curates
   algorithmically, which is the one thing this product cannot do — and its
   media grid is refused because this list is not all media. X's Top / Latest /
   People tabs are refused twice over: a segmented row of tiers the contract
   cannot serve, on a page that would then just be search again. Tumblr's
   "post this tag" button is a compose entrance nothing has ruled, so it is not
   invented here.

   THE FIRST PAGE THAT GETS NO ANSWER (round 48; the `load` chip's `failed`):
   the fault family's one shape, `ProfileUnreachable`'s — the header standing,
   the house line's noun form in the page's place, `Can't reach the server —
   this tag can't load right now.`, over an outlined `Retry` leading the
   column (copy-voice, *No answer at all*). The noun is the page's own, as
   `this profile` is the profile's; the picker's `tags can't load right now.`
   names a list of tags, not this page. Blessed (jakob 2026-11-13, N10).

   A NAME THAT CANNOT BE A TAG (jakob 2026-11-13, N4; the `load` chip's
   `notFound`): a link or a typed address whose name breaks the naming gate
   — a space, a character no name may carry, past 128 — names no Type at
   all, so the answer is the not-found family's, `ProfileNotFound`'s shape:
   the header keeping the name asked for, since it is the only thing known
   about what was asked (jakob 2026-11-17: "keep the asked for name"), `This tag doesn't exist.` as an `EmptyState` in the
   page's place, no Retry and no stance row — nothing about asking again
   makes a tag exist. A LEGAL name nobody has used is not this: it is a tag
   nothing carries yet (`TagPageEmpty`).

   A REMOVED TAGGED POST FOLLOWS THE FEED'S SWITCH (round 57; jakob
   2026-11-18, tag page (c): "one switch that already exists"; the `post`
   chip's `removed`). While the feed's filter has `Also show → Removed` on,
   a removed tagged post stands in its row as the feed's removed card
   (`FeedRemoved`) under its claim; while it is off, the post is not listed —
   from the page's next derivation, as the feed's own two sentences put it.
   Nothing new stands on this page: the switch is the feed's. The drawn
   state is the first row, @tobias's post, the one row nothing else on the
   page points at (@ada's tagged comment answers @sol's post); the card is
   the feed's removed card, its ⋮ the reader's. `TagPageRemovedMenu` and
   `TagPageRemovedMenuOwn` draw the two menus.

   A REMOVED TAGGED COMMENT FOLLOWS THE SAME SWITCH (round 58; jakob
   2026-11-18, C4 "as rec"; the `comment` chip's `removed`): every removed row
   the page lists is listed or not by the feed's `Removed`, the comment as the
   post. On, @ada's tagged comment stands in its row under its claim with
   `CommentCard`'s own mark, `Removed by its author` and the removal's `2h`,
   in the words' place, as `ProfileComments`' `removed` draws the same
   comment, its author, its age and its pointer kept.

   A TAGGED COMMENT'S ⋮ RAISES THE COMMENT'S WHOLE MENU (round 60; jakob
   2026-11-19, C2 "as rec"): the reader's comment menu on another's, live or
   removed, the own comment menu on your own and its removed rows once
   removed (copy-voice, *Menu rows*, a tag page among the hosts) —
   `TagPageCommentMenu`, `…Own`, `TagPageCommentRemovedMenu`, `…Own` draw
   the four open.

   REGISTERED under the `tagPage` prefix (round 60, seam 380 / 381): the
   page's own nodes in android's names — the header, the topic's row
   (`actionRow.stance`, `actionRow.share`, round 48's names, so the share is
   `tagPage.actionRow.share`, not a top-level `share`), each row's `claim`
   with its `glyph`, `exact` and `pending`, keyed by the tagged thing's id,
   each post `card` (its removed copy's `card.removalMark`) and the comment
   `commentCard`, keyed by their ids. The `post` and `comment` chips' copies
   carry their chip's marker. The failed and not-found states stay unnamed.

   A TAGGED COMMENT WITH MEDIA (round 62, seam 403.1): the `comment` chip's
   `pictures` and `clip` draw @ada's tagged comment carrying the thread's two
   pictures and its clip (`ReplyMedia`), so `commentCard.media`, its `frame`,
   the frame's `soundDisc` and the `dots` register by the thread's names.

   A GUEST'S TAG PAGE (round 62, seam 404.3) is the `reader` chip's `guest`:
   the topic's wide anchor reads `@genesis_mod's opinion` beside the hollow
   face (`READER_CHIP`, `StanceControl`'s `vantage`), the rest as drawn. */

/* THE FULL NAME (round 63; jakob 2026-11-23, point 3 (b): "only on the tags
   page itself we show the full tags name when it is too long"): the `name`
   chip's `long` and `long-hyphens` title the page with a 128-character tag,
   the longest a name may be (hashtag.md: the L1 identifier atom), without a
   hyphen and with them — the length refusal's own name (`TagPickerRefused`)
   at 128. The header cuts it on one line with "…"; the full name stands under
   the header as a wrapping heading (`TagFullName`, registered `name`), above
   the topic's row. `short` is `#saltmaps`, which fits, so no heading stands.
   The topic's spoken names keep `#saltmaps`.

   THE HEADING SHRINKS TO FIT (round 66; jakob 2026-11-23, "as rec"): the
   largest whole pixel from 22 down that holds the whole name on two lines,
   never below 12px, its leading round(size × 28 / 22) — the profile head's
   rule (`nameFitSize`) with a floor the head does not have. Each value
   carries the size the rule gives its sample at the board's 390px:
   `middle` the long name cut to 85 characters at its word `light`, two
   lines at 17px on 22px (16px at 360, 18px at 412); `long` and
   `long-hyphens` at the floor, 12px on 15px, three lines (three at 360, two
   at 412) — no 128-character name needs a fourth.

   A GUEST'S FACES ARE THE BORROWED VIEW'S (round 63; jakob 2026-11-23,
   point 7 "build it"): on the `reader` chip's `guest` the view holds one
   opinion on the page — @tobias's post, the face the member's fixture draws —
   and none on the topic, @sol's post or @ada's comment, which wear the hollow
   face; every anchor is spoken `@genesis_mod's opinion on …` (point 8 (a)). */
const LONG_NAME = "salt_maps_of_the_coast_road_and_the_third_headland_light_and_the_third_headland_light_and_the_third_headland_light_and_the_third";
const MIDDLE_NAME = LONG_NAME.slice(0, 85);

export const NODE = "tagPage";
export const FRAME = { width: 390, height: 1344 };
export const PROPS = {
  load: { editor: "enum", options: ["loaded", "failed", "notFound"], default: "loaded" },
  post: { editor: "enum", options: ["live", "removed"], default: "live" },
  comment: { editor: "enum", options: ["live", "removed", "pictures", "clip"], default: "live" },
  name: { editor: "enum", options: ["short", "middle", "long", "long-hyphens"], default: "short" },
  ...READER_CHIP,
};
export const VALS = `loadedShown: this.props.load === "loaded" ? "contents" : "none", failedShown: this.props.load === "failed" ? "contents" : "none", notFoundShown: this.props.load === "notFound" ? "contents" : "none", postLive: this.props.post === "removed" ? "none" : "contents", postRemoved: this.props.post === "removed" ? "contents" : "none", commentLive: this.props.comment === "live" ? "contents" : "none", commentRemoved: this.props.comment === "removed" ? "contents" : "none", commentPictures: this.props.comment === "pictures" ? "contents" : "none", commentClip: this.props.comment === "clip" ? "contents" : "none", tagName: this.props.name === "middle" ? ${JSON.stringify(MIDDLE_NAME)} : this.props.name === "long" ? ${JSON.stringify(LONG_NAME)} : this.props.name === "long-hyphens" ? ${JSON.stringify(LONG_NAME.replaceAll("_", "-"))} : "saltmaps", tagHeading: this.props.name === "short" ? "none" : "block", tagHeadingSize: this.props.name === "middle" ? "17px" : this.props.name === "short" ? "var(--text-title-large)" : "12px", tagHeadingLineHeight: this.props.name === "middle" ? "22px" : this.props.name === "short" ? "var(--text-title-large--line-height)" : "15px",${READER_VALS}, ${readerNames([
  ["readerTopicName", "#saltmaps", undefined, undefined],
  ["readerTobiasName", "this post", mkBundle(0.1, 0.1), mkBundle(0.1, 0.1)],
  ["readerSolName", "this post", mkBundle(0.1, 0.1), undefined],
  ["readerAdaName", "this comment", mkBundle(0.1, 0.1), undefined],
])}`;

export function Screen() {
  return (
    <>
      <div style={{ display: "{{loadedShown}}" }}>
        <TagPageBody removed="hole" commentRemoved="hole" named vantageHoles={READER_HOLES} title="#{{tagName}}" heading="{{tagHeading}}" headingSize="{{tagHeadingSize}}" headingLineHeight="{{tagHeadingLineHeight}}" />
      </div>
      <div style={{ display: "{{failedShown}}" }}>
        <PageHeader title="#{{tagName}}" backHref="#" backLabel="Back to Explore" />
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--space-3)", padding: "16px 24px" }}>
          <TransportError message="Can't reach the server — this tag can't load right now." />
          <Button variant="outline" size="sm" selfStart>
            Retry
          </Button>
        </div>
      </div>
      <div style={{ display: "{{notFoundShown}}" }}>
        <PageHeader title="#salt maps" backHref="#" backLabel="Back to Explore" />
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "8px 24px" }}>
          <EmptyState title="This tag doesn't exist." />
        </div>
      </div>
    </>
  );
}

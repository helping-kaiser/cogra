/* The feed's filter sheet, open — the whole control lives here: four kinds that
   combine, forms of post, the Order section with the seen toggle (shared with
   search), what else is admitted, the one topic that does not combine, and the
   foot — `Reset` in its corner, `Done` at its end. It stages: the feed behind
   the sheet is visual only and does not move until Done commits, when it
   re-queries once; the scrim, a swipe down, system Back and Escape discard
   (the sheet law, readme §4, *Sheets*).

   THE TOPICS CLOSE THE BODY (jakob 2026-10-02). They are the section that
   grows with the reader's own tags, so they sit last and never push a fixed
   section below the unscrolled view.

   `Reset` STAGES THE READER'S DEFAULT (jakob 2026-10-02, pass C 10): the
   app's until they set their own in Settings, theirs after — and the pill
   speaks deviations from the same default. CoGra's own default comes back
   only in Settings. This reader never set one, so the sheet is drawn at the
   app's.

   THE TRIGGER MEASURES AGAINST THE READER'S DEFAULT (jakob 2026-10-02, the
   fix-fix round's ruling 10), a deviation back toward the app's included:
   under a Newest default, `Ranked` is a deviation the pill speaks, as
   `newest` is under the app's. Each axis speaks its state, never the
   direction (the residue round's Q2; the words are `FeedFilter`'s). The
   summary keys on the reader's default object, never the app's constant.
   The "?" says what `Reset` does: `Reset
   brings back your defaults, to change them go to settings.` (ruling 11).

   THE FOUR ARE THE KINDS V1.0 SERVES (readme §13, the V1.0 scope cut,
   2026-09-25): Posts, Comments, Profiles, Tags. A kind list follows the
   staging rule, so no chip stands for a kind the release does not carry.

   THE TOPIC FEED IS A SECTION OF THIS SHEET (jakob, 2026-09-14: "a topic feed
   is just another feed setting"). It is not a tab, not a second feed, and not a
   surface — it is the narrowing a reader already knows how to reach, in the
   control they already use for every other narrowing. The chips are the topics
   held FOR; the way to everything held, including the ones held against, is the
   text button under them.

   "ALSO SHOW" CARRIES THREE CHIPS, AND `Still settling` IS ON (jakob
   2026-10-12, seam 137). Content authored and not yet landed is woven in
   among the landed rows by default, wearing its pending marker, ranked by
   the reader's reach to its author through the one edge it was born with.
   Switched off, the feed keeps to what has landed, and the trigger says so:
   `settled only`. `Sensitive` and `Removed` stay off until asked for.

   THE `people` CHIP (jakob 2026-10-12, item 7). The sheet is drawn at the
   default, `Everyone`; the chip's `your-people` draws the section with `Your
   people` chosen and its one-line sign row under it — `For · Against ·
   Either`, `Either` the default and in primary ink. */
/* REGISTERED under the `feed` prefix (seam 248). The sheet is drawn beside
   the band, not inside the trigger, so it takes the path `feed.filterSheet`
   — `HistoryFilter`'s arrangement: the trigger stands expanded, reading the
   default, and the sheet is the same `FeedFilterSheet` the trigger raises,
   with `FeedFilter`'s own foot. */
export const NODE = "feed";
export const PROPS = PEOPLE_CHIP;
export const VALS = PEOPLE_VALS;

export function Screen() {
  return (
    <>
      <CograBand trailing={<FilterTrigger reading="Posts" expanded ariaLabel="What your feed shows" node="filterTrigger" />} node="band" />
      <FeedList>
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} node="card" />
        <PostCard {...TOBIAS_POST} bundle={mkBundle(0.1, 0.1)} node="card" />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />
      <FeedFilterSheet
        open
        topics={FEED_TOPICS}
        onOpenTopics={() => {}}
        peopleRows={<PeopleCopies node="filterSheet" />}
        foot={<FilterFoot node="foot" />}
        node="filterSheet"
      />
    </>
  );
}

/* The feed's filter sheet, open — the whole control lives here: four kinds that
   combine, forms of post, the Order section with the seen toggle (shared with
   search), what else is admitted, the one topic that does not combine, and the
   foot — `Reset` in its corner, `Done` at its end. It stages: the feed behind
   the sheet is visual only and does not move until Done commits, when it
   re-queries once; the scrim, a swipe down and Back discard (the sheet law,
   readme §4, *Sheets*).

   THE TOPICS CLOSE THE BODY (jakob 2026-10-02). They are the section that
   grows with the reader's own tags, so they sit last and never push a fixed
   section below the unscrolled view.

   `Reset` STAGES THE READER'S DEFAULT (jakob 2026-10-02, pass C 10): the
   app's until they set their own in Settings, theirs after — and the pill
   speaks deviations from the same default. CoGra's own default comes back
   only in Settings. This reader never set one, so the sheet is drawn at the
   app's.

   THE FOUR ARE THE KINDS V1.0 SERVES (readme §13, the V1.0 scope cut,
   2026-09-25): Posts, Comments, Profiles, Tags. A kind list follows the
   staging rule, so no chip stands for a kind the release does not carry.

   THE TOPIC FEED IS A SECTION OF THIS SHEET (jakob, 2026-09-14: "a topic feed
   is just another feed setting"). It is not a tab, not a second feed, and not a
   surface — it is the narrowing a reader already knows how to reach, in the
   control they already use for every other narrowing. The chips are the topics
   held FOR; the way to everything held, including the ones held against, is the
   text button under them.

   "ALSO SHOW" CARRIES THREE CHIPS, AND `Still settling` IS ON (jakob,
   2026-10-01; readme §13, the V1.0 scope cut). Content authored and not yet
   landed reaches the feed by default, wearing its pending marker — the feed
   as it has always been. Switched off, the feed keeps to what has landed, and
   the trigger says so: `settled only`. `Sensitive` and `Removed` stay off
   until asked for. */
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter defaultOpen topics={FEED_TOPICS} onOpenTopics={() => {}} />} />
      <FeedList>
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} />
        <PostCard {...TOBIAS_POST} bundle={mkBundle(0.1, 0.1)} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}

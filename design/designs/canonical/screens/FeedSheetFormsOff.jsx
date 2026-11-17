/* THE FEED'S FILTER SHEET WITH NO KIND THAT HAS FORMS (round 48, seam
   323-2). `FeedSheet` drawn with Posts and Comments staged off and Profiles
   and Tags on: `Kinds of post` stands disabled and its hint reads `Applies
   once posts or comments are in.` — the master's (`FeedFilter`) and
   copy-voice's line, which round 42 kept while it cut the posts-on hint, and
   which no board drew until now. Everything else is `FeedSheet`'s: the sheet
   stages, so the trigger and the feed behind it still read what was applied.

   REGISTERED under the `feed` prefix, `FeedSheet`'s names; the hint is
   `filterSheet.forms.hint`. */
export const NODE = "feed";

const FORMS_OFF = { ...FEED_FILTER_DEFAULT, kinds: ["profiles", "topics"] };

export function Screen() {
  return (
    <>
      <CograBand trailing={<FilterTrigger reading="Posts" expanded ariaLabel="What your feed shows" node="filterTrigger" />} node="band" />
      <FeedList>
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} node="card" />
        <PostCard {...TOBIAS_POST} bundle={mkBundle(0.1, 0.1)} node="card" />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />
      <FeedFilterSheet open value={FORMS_OFF} topics={FEED_TOPICS} onOpenTopics={() => {}} foot={<FilterFoot node="foot" />} node="filterSheet" />
    </>
  );
}

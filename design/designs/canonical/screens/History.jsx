/* HISTORY — everything you have seen, as a feed (jakob 2026-10-05, the
   History redesign: "this history should be a full feed with all the contents
   i have looked at in it (in their normal feed form). and we should make it
   searchable"). A sibling of Saved, reached from the same ⋮.

   THE HISTORY IS THE SEEN-LIST. It is the list slice-3 ranking filters the
   feed by, so that seeing a thing twice in the feed is a deliberate choice —
   and nothing else: the page surfaces exactly that list. A content is SEEN
   when it was fully in the viewport. There is no second definition here, and
   no seeing this page invents.

   EVERY SERVED KIND, IN ITS NORMAL FEED FORM. Posts, comments, profiles and
   tags — the four kinds `FEED_KINDS` serves — and every kind the feed serves
   later joins because this page is a feed. Each card is its kind's own feed
   master, unchanged and fully live: the opinion, the score, the kind's own act
   and the share answer here exactly as they do on the feed, and every door
   lands where the feed's does. No card anatomy is this page's own.

   NEWEST-SEEN FIRST. The order is the latest time each thing was seen; a
   thing seen again sits where the latest seeing put it, once. The scores do
   not order this list, so the figure each card wears is its own and the column
   is not a rank.

   SEARCH AND FILTER ON TOP (a lane call, flagged for jakob's canvas pass).
   The search field is the system's one search bar, its placeholder naming the
   list it searches; under it the feed's worded trigger, in search's
   position and search's kind semantics — nothing narrowed reads `Everything`,
   and a chip narrows. Its sheet is `HistoryFilter`. The bar and the trigger
   ride the collapsing top with the header (readme §4: history collapses).

   IT IS DRAWN WHOLE, for `TagPage`'s reason: what this board records is a mix
   of kinds, and a mix cut off at 844px is one kind and a fragment.

   NO CLEAR, AND NO PER-ROW REMOVE. Neither is ruled; removing a seen record
   would also put the thing back into the reader's feed, which is a decision,
   not a control to invent beside the list (backlog `13X-history`). */
export const FRAME = { width: 390, height: 1620 };

export function Screen() {
  return (
    <>
      <PageHeader title="History" backHref="#" backLabel="Back to your profile" />
      <div style={{ flex: "none" }}>
        <SearchBar placeholder="Search your history" ariaLabel="Search your history" />
        <div style={{ display: "flex", alignItems: "center", padding: "0 16px 8px 16px" }}>
          <FilterTrigger reading="Everything" ariaLabel="What your history shows" />
        </div>
      </div>
      <FeedList>
        <CommentFeedCard
          author={TOBIAS}
          content={TOBIAS_COMMENT}
          timestamp="1h"
          parent={ADA_POST}
          topics={["glovebox", "coastroad"]}
          score="12.40"
        />
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} />
        <ProfileFeedCard person={MIRA} src="inviter.jpg" bio="Runs the stand by the sea wall — honey from the headland hives." score="11.70" />
        <TagFeedCard name="#saltmaps" through={["ada", "tobias"]} tagged={SALTMAPS_TAGGED} score="10.30" />
        <PostCard {...TOBIAS_POST} bundle={mkBundle(0.1, 0.1)} />
      </FeedList>
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}

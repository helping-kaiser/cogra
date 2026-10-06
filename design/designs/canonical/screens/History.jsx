/* HISTORY — everything you have seen, as a feed (jakob 2026-10-05, the
   History redesign: "this history should be a full feed with all the contents
   i have looked at in it (in their normal feed form). and we should make it
   searchable"). A sibling of Saved, reached from the same ⋮.

   THE HISTORY IS THE SEEN-LIST. It is the list slice-3 ranking filters the
   feed by, so that seeing a thing twice in the feed is a deliberate choice —
   and nothing else: the page surfaces exactly that list. A content is SEEN
   when it was fully in the viewport, and only the FIRST seeing counts (jakob
   2026-10-05: "re-seeing must never be counted.. once a content is in the
   list it is in the list"). The seen-list is the app's own state: seeing
   never reaches the graph, where only the reader's manual gestures become
   records. There is no second definition here, and no seeing this page
   invents.

   EVERY SERVED KIND, IN ITS NORMAL FEED FORM. Posts, comments, profiles and
   tags — the four kinds `FEED_KINDS` serves — and every kind the feed serves
   later joins because this page is a feed. Each card is its kind's own feed
   master, unchanged and fully live: the opinion, the score, the kind's own act
   and the share answer here exactly as they do on the feed, and every door
   lands where the feed's does. No card anatomy is this page's own.

   NEWEST FIRST, BY FIRST SEEING. The order is the time each thing was first
   seen, newest first; a thing seen again never moves and never stands twice.
   The scores do not order this list, so the figure each card wears is its own
   and the column is not a rank.

   QUIET DAY DIVIDERS (jakob 2026-10-05, the final brief's 4). Above the first
   thing seen on a day, a divider names that day in the age wording —
   `Today`, `Yesterday`, then the date (`HistoryDayDivider`) — so "the post I
   saw three days ago" has a place to scroll to. They belong to the list, not
   to the cards. Strings blessed (jakob 2026-10-05).

   SEARCH AND FILTER ON TOP. The search field is the system's one search bar,
   its placeholder naming the list it searches, and it matches by the one
   search rule Explore uses (readme §4, *Search*) — over the seen-list alone,
   newest-seen first. Under it the feed's worded trigger, in search's position
   and search's kind semantics — nothing narrowed reads `Everything`, and a
   chip narrows. Its sheet is `HistoryFilter`. The bar and the trigger ride
   the collapsing top with the header (readme §4: history collapses). A search
   or a narrowing that finds nothing is `HistoryNone`.

   THE FEED'S SCROLL TOOLS (jakob 2026-10-05). The pull-down all the way at
   the top re-reads the list; deep in it, `Back to top` rides in with the
   returning top, as on the feed; and the order is frozen for each open, so
   a seeing made meanwhile joins at the next open or the next pull, never
   mid-scroll.

   WHAT THE STANDING LAWS SAY HERE. A thing removed after it was seen keeps
   its place and wears its removal mark — a removal is never erased silently.
   A hidden account's things stay out while it is hidden, as they stay out of
   the feed. Sensitive content keeps its veil, as on the feed.

   IT IS DRAWN WHOLE, for `TagPage`'s reason: what this board records is a mix
   of kinds, and a mix cut off at 844px is one kind and a fragment.

   NO CLEAR, AND NO PER-ITEM REMOVE (jakob 2026-10-05: "no need for it"). The
   list is the feed's seen filter, so taking a thing out of it would put that
   thing back into the reader's feed; History offers neither control. */
export const FRAME = { width: 390, height: 1720 };

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
        <HistoryDayDivider>Today</HistoryDayDivider>
        <CommentFeedCard
          author={TOBIAS}
          content={TOBIAS_COMMENT}
          timestamp="1h"
          parent={ADA_POST}
          topics={["glovebox", "coastroad"]}
          score="12.40"
        />
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} />
        <HistoryDayDivider>Yesterday</HistoryDayDivider>
        <ProfileFeedCard person={MIRA} src="inviter.jpg" bio="Runs the stand by the sea wall — honey from the headland hives." score="11.70" />
        <TagFeedCard name="#saltmaps" through={["ada", "tobias"]} tagged={SALTMAPS_TAGGED} score="10.30" />
        <HistoryDayDivider>2 October</HistoryDayDivider>
        {/* First seen three days ago, so it is at least that old: its own age
            reads 3d, never younger than the day it was seen. */}
        <PostCard {...TOBIAS_POST} timestamp="3d" bundle={mkBundle(0.1, 0.1)} />
      </FeedList>
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}

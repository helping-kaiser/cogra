/* HISTORY, JUST AFTER HIDING SOMEONE FROM A CARD IN IT (jakob 2026-10-09,
   item 83 — the aftermath extension; #122's shape). The same tap the feed's
   board records — a card's ⋮, `Hide @ada`, the sheet closing — made on a
   card in History instead.

   THE LIST STANDS AS IT STOOD. History's order is frozen for each open (its
   own law: what changes meanwhile joins at the next open or the next pull),
   and hiding is no exception — the surface the tap was made on does not
   rearrange under the reader's thumb. So @ada's card is still in its place
   under the snackbar, nothing marking it; the standing law "a hidden
   account's posts and comments stay out of History" takes hold at the next
   open or pull, where every other change does. Her own profile card would
   stay even then (jakob 2026-10-07, ruling 11).

   THE SNACKBAR IS THE FEED'S, WORD FOR WORD — `@ada is hidden — their posts
   stay out of your feed.` with `Undo` — because the act's reach is the same
   whichever surface the tap was made on. It lands over History, above its
   bar (`Snackbar`'s 80px).

   IT IS `History`'s TOP VIEWPORT WITH THE SNACKBAR OVER IT, drawn at the
   phone's own 844 because the aftermath is a moment, not the whole scroll —
   `FeedHidden`'s construction, met on the third surface.

   REGISTERED under the `history` prefix, named as `History` names it; the
   snackbar is `snackbar`, its `message` and its `action`. */
export const NODE = "history";
export function Screen() {
  return (
    <>
      <PageHeader title="History" backHref="#" backLabel="Back to your profile" node="header" />
      <div style={{ flex: "none" }}>
        <SearchBar placeholder="Search your history" ariaLabel="Search your history" node="searchField" />
        <div style={{ display: "flex", alignItems: "center", padding: "0 16px 8px 16px" }}>
          <FilterTrigger reading="Everything" ariaLabel="What your history shows" node="filterTrigger" />
        </div>
      </div>
      <FeedList>
        <HistoryDayDivider node="day" nodeKey="today">
          Today
        </HistoryDayDivider>
        <CommentFeedCard
          author={TOBIAS}
          content={TOBIAS_COMMENT}
          timestamp="1h"
          parent={ADA_POST}
          topics={["glovebox", "coastroad"]}
          score="12.40"
          node="commentCard"
        />
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} node="card" />
      </FeedList>
      <Snackbar message="@ada is hidden — their posts stay out of your feed." action="Undo" offset={80} node="snackbar" />
      <BottomNav active="profile" slots={ALL_SLOTS} inline node="bottomBar" />
    </>
  );
}

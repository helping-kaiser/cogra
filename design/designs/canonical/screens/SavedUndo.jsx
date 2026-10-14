/* SAVED, THE MOMENT AFTER A CARD IS UNSAVED (jakob 2026-09-11: unsaving gets
   the same treatment as hiding; re-voiced for cards with the Saved redesign,
   jakob 2026-10-14).

   THE BOARD EXISTS BECAUSE THE ACT IS INVISIBLE OTHERWISE. The unsave takes no
   dialog and leaves no mark: the card's own Save — its ⋮'s first row, reading
   `Unsave` on every card in Saved — closes the sheet on the tap, and the only
   thing a reader ever sees of it is a list with one card fewer and one line
   saying so. That line and that list ARE the design, so they get drawn.

   THE CARD IS GONE AND THE LIST HAS CLOSED OVER IT. `The long way home` led
   this list a moment ago; here the cards behind it have simply moved up.
   Nothing marks the space it was in: a struck-through card would keep the
   thing on the screen the reader just asked to be rid of it on, and nothing
   has happened to the post itself — it still stands in its author's
   chronicle, still ranks, still opens. Saving is private, and so is losing a
   save.

   THE LINE SAYS WHAT HAPPENED, NOT WHAT WAS LOST. `Removed from Saved.` names
   the list rather than the thing, because the card that went is the one the
   reader just pressed and naming it back to them says nothing they do not
   already know — while the LIST is the fact they may want reversed. `Undo`
   beside it (`Snackbar`'s one action): a mis-press is the cheapest mistake in
   the product, and the way back should cost what the mistake cost.

   THE SAME LINE RIDES `SavedEmpty`, when the card that went was the last one
   (jakob 2026-09-12). The snackbar belongs to the ACT, not to how many cards
   are left behind it, so the empty board takes the same words over the same
   seconds and the empty line reads underneath them. Recorded rather than
   drawn: this board is the demonstration.

   IT IS `Saved`'s TOP VIEWPORT WITH THE SNACKBAR OVER IT, drawn at the
   phone's own 844 because the aftermath is a moment, not the whole scroll —
   `HistoryHidden`'s construction one list over. The header, the field, the
   cards and the bar are that board's, drawn once; the comment, the person and
   the words post left are all still there, so the list goes on reading as the
   one mixed list it is.

   REGISTERED under the `saved` prefix, named as `Saved` names it (seam
   059/061, the Saved packet); the snackbar is `snackbar`, its `message` and
   its `action`. */
export const NODE = "saved";
export function Screen() {
  return (
    <>
      <PageHeader title="Saved" backHref="#" backLabel="Back to your profile" node="header" />
      <div style={{ flex: "none" }}>
        <SearchBar placeholder="Search what you saved" ariaLabel="Search what you saved" node="searchField" />
      </div>
      <FeedList>
        <CommentFeedCard
          author={TOBIAS}
          content={TOBIAS_COMMENT}
          timestamp="1h"
          parent={ADA_POST}
          topics={["glovebox", "coastroad"]}
          score="12.40"
          node="commentCard"
        />
        <ProfileFeedCard
          person={MIRA}
          src="inviter.jpg"
          bio="Runs the stand by the sea wall — honey from the headland hives."
          score="11.70"
          node="profileCard"
        />
        <PostCard {...TOBIAS_POST} bundle={mkBundle(0.1, 0.1)} node="card" />
      </FeedList>
      <Snackbar message="Removed from Saved." action="Undo" offset={80} node="snackbar" />
      <BottomNav active="profile" slots={ALL_SLOTS} inline node="bottomBar" />
    </>
  );
}

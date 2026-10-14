/* SAVED — everything you kept, as a feed (jakob 2026-10-14, the Saved
   redesign: "a normal feed looking page that is just composed of my saved
   contents... just like history is a normal feed composed of my view
   history"). The sibling of `History`, reached from the same ⋮ on your own
   profile.

   ONE MIXED LIST, NEVER A TAB PER KIND (jakob 2026-09-11, standing). A reader
   looking for the thing they kept on Tuesday is looking for a moment, not a
   category, so the kinds share one column and nothing on this page narrows it
   by kind.

   EVERY SAVED KIND, IN ITS NORMAL FEED FORM. The saveable kinds are posts,
   comments and people — the three a ⋮ offers `Save` on — and each stands as
   its kind's own feed master: `PostCard`, `CommentFeedCard`,
   `ProfileFeedCard`. Unchanged and fully live: the opinion, the score, the
   kind's own act and the share answer here exactly as on the feed, and every
   door lands where the feed's does. No card anatomy is this page's own. A tag
   is never saved (a Type carries no ⋮), so `TagFeedCard` never stands here.
   The chat message is the one saveable kind not drawn: chats have no boards
   yet, so its card lands with the chat round and joins this same list rather
   than starting a second one.

   NEWEST FIRST, BY WHEN YOU SAVED IT — never by when it was written or when it
   was seen. The list is a record of your own act. So the ages the cards wear
   are their own and need not run in order here — the post written 2h ago
   leads the comment written 1h ago because it was kept later — and the
   scores do not order it either.

   THE UNSAVE IS THE CARD'S OWN SAVE (jakob 2026-10-14). A card's Save control
   is its ⋮'s first row — `Save` while a thing is not kept, `Unsave` while it
   is — and on this page every card is kept, so that row stands as `Unsave` on
   every one of them. Tapping it unsaves: the sheet closes, the card leaves,
   the cards behind it move up, and `Removed from Saved.` with `Undo` answers
   (`SavedUndo`). There is no per-card control of the page's own, and no card
   carries a saved mark anywhere, here or on the feed (the menu laws).

   SEARCH ON TOP (jakob 2026-10-14: "we are using the same search just over a
   different set of nodes"). The field is the system's one search bar, its
   placeholder naming the list it searches, and it matches by the one search
   rule Explore uses (readme §4, *Search*) — over the saved list alone, newest
   first by when each thing was saved. It rides the collapsing top with the
   header. A search that finds nothing is `SavedNone`. History's kinds trigger
   has no counterpart here: a kind filter on this list is not ruled.

   WHAT THE STANDING LAWS SAY HERE. A thing removed after it was saved keeps
   its place and wears its removal mark; a deleted account's card is the
   redacted profile card; sensitive content keeps its veil, as on the feed;
   and a hidden account's things and profile STAY — the hidden list is the
   feed's, not this one's.

   IT IS DRAWN WHOLE, for `History`'s reason: a mix cut off at 844px is one
   kind and a fragment.

   REGISTERED under the `saved` prefix (design ⇄ impl seam 059/061, the Saved
   packet), with `SavedEmpty`, `SavedUndo` and `SavedNone`. Every card keeps
   the name and key its kind has on the feed — `card` and `commentCard` by
   their author, `profileCard` by the person — because each is the feed's own
   card; the list holding them is the feed's, unnamed there and here. The
   field is `searchField`. */
export const NODE = "saved";
export const FRAME = { width: 390, height: 1560 };

export function Screen() {
  return (
    <>
      <PageHeader title="Saved" backHref="#" backLabel="Back to your profile" node="header" />
      <div style={{ flex: "none" }}>
        <SearchBar placeholder="Search what you saved" ariaLabel="Search what you saved" node="searchField" />
      </div>
      <FeedList>
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} node="card" />
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
      <BottomNav active="profile" slots={ALL_SLOTS} inline node="bottomBar" />
    </>
  );
}

/* THE FEED WITH CHATS AND MESSAGES IN IT — the two opt-in feed kinds, drawn
   (round B3 of the chats work, the integration round; rebuilt on jakob's
   canvas review, the fix pass, 2026-09-24).

   BOTH KINDS WERE DECLARED AND NEVER DRAWN. The feed's filter has listed
   `Chats` and `Messages` since its one list (`FEED_KINDS`), off by default; a
   reader who turns them on meets these cards. The trigger reads the kinds back
   as it always does — the filter's own summary, nothing added.

   REAL CARDS, NOTHING HAND-BUILT (the componentization law). Both are the
   feed's own `PostCard`, mounted (`ChatFeedCard`, `MessageFeedCard`): its
   header and ⋮, its body, and its NORMAL action row — the opinion face, the
   score, the comments, the share. THE CARD ITSELF IS THE DOOR, as a post card
   opens its detail: the chat's card opens its thread (read from outside with
   the join at the foot, or the reader's own), the message's card opens its
   thread scrolled to the message. No `Join`, no `Open in the chat` on a card —
   the join lives inside.

   THE ⋮ WENT MISSING, AND WHY (jakob's review). The first drawing hand-built
   both chat cards on `Card`, so they had no menu at all; and the ordinary post
   below them was the real `PostCard` handed the change-histories round's
   fixture, which carries no `license` and no `menuItems` — and `PostCard` draws
   its ⋮ only when it has something to put in it (`OverflowMenu` renders nothing
   for an empty list). All three now carry the card menu and a license, the way
   every canonical card fixture does.

   THE SHARE IS THE SHARE GLYPH, AND IT OPENS `Send to a chat` (jakob's
   ruling, the fix pass): on these cards as on every card, the share act always
   opens the send sheet, with `Share outside CoGra` inside it.

   NO SECOND ALGORITHM. Both kinds rank by the ordinary rank, beside posts —
   a lineage as one candidate (chats.md §3), a message as the first-class
   content it is (§1).

   THE MIGRATION NOTE: the feed is canonical's (`Feed`), whose filter draws
   the two kinds as switches that change nothing drawn yet. At migration these
   cards join the feed's card set and this excerpt goes; the post below the two
   is this tree's own fixture standing for canonical's cards. */
const JUNO = { handle: "juno", displayName: "Juno Baptiste" };

export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter value={{ kinds: ["posts", "chats", "messages"] }} />} />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 8, padding: "8px 0 0 0" }}>
        <ChatFeedCard
          name="Sea wall market"
          policy="open"
          description="What's on the stands by the sea wall this week, and who is minding them."
          members={14}
          lastAge="35m"
          score="5.60"
          comments={4}
        />
        <MessageFeedCard chat="Slipway repairs" author={JUNO} age="2h" score="2.30" comments={1}>
          Bring gloves — the new planks splinter. We start at the north end at nine.
        </MessageFeedCard>
        <PostCard {...SALT_MAPS_CURRENT} timestamp="3d" score="9.10" comments={2} license={PUBLIC_DOMAIN} menuItems={CHAT_CARD_MENU} onOpen={() => {}} />
      </div>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}

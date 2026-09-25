/* THE FEED WITH CHATS AND MESSAGES IN IT — the two opt-in feed kinds, drawn
   (round B3 of the chats work, the integration round; rebuilt on jakob's
   canvas review, the fix pass, 2026-09-24).

   BOTH KINDS ARRIVE WITH THIS ROUND. Canonical's one list (`FEED_KINDS`)
   carries only the kinds V1.0 serves (readme §13, the V1.0 scope cut);
   `Chats` and `Messages` join it when chats ship, off by default, and a reader
   who turns them on meets these cards. The trigger reads the kinds back as it
   always does — the filter's own summary, nothing added.

   REAL CARDS, NOTHING HAND-BUILT (the componentization law). Both are the
   feed's own `PostCard`, mounted (`ChatFeedCard`, `MessageFeedCard`): its
   header and ⋮, its license, and its NORMAL action row — the opinion face, the
   score, the comments, the share. THE CARD ITSELF IS THE DOOR, as a post card
   opens its detail: the chat's card opens its thread (read from outside with
   the join at the foot, or the reader's own), the message's card opens its
   thread scrolled to the message. No `Join`, no `Open in the chat` on a card —
   the join lives inside.

   REDRAWN FOR JAKOB TO JUDGE ON THE CANVAS (the final micro-fix): the message
   card's author line is `Mira Voss · in Coast walkers` and its body is the
   message as the thread's own bubble, tail and tucked clock; the chat card's
   author line is the chat's disc, its name and the `forum` kind mark, the
   policy line under them, and its body is the last message as a preview row.
   Neither reads as a text post. Both ride `PostCard`'s additive `lead` and
   `main` slots — the second design-system touch of the micro-fix, flagged.

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

   THE MIGRATION NOTE: the feed is canonical's (`Feed`). At migration the two
   kinds join `FEED_KINDS` — and so search's filter too, the list being one —
   these cards join the feed's card set, and this excerpt goes; the post below
   the two is this tree's own fixture standing for canonical's cards. */
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter value={{ kinds: ["posts", "chats", "messages"] }} />} />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 8, padding: "8px 0 0 0" }}>
        <ChatFeedCard
          name="Sea wall market"
          image="gallery-honey.jpg"
          policy="open"
          lastAge="35m"
          last={{ sender: "Mira Voss", src: "inviter.jpg", words: "Honey is back on the stand from Saturday." }}
          score="5.60"
          comments={4}
        />
        <MessageFeedCard chat="Coast walkers" author={MIRA} bubbleAuthor={CHAT_MIRA} when="08:40" age="2h" score="2.30" comments={1}>
          Six it is. Meet at the harbour office.
        </MessageFeedCard>
        <PostCard {...SALT_MAPS_CURRENT} timestamp="3d" score="9.10" comments={2} license={PUBLIC_DOMAIN} menuItems={CHAT_CARD_MENU} onOpen={() => {}} />
      </div>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}

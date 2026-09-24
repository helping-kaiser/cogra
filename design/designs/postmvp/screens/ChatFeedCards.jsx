/* THE FEED WITH CHATS AND MESSAGES IN IT — the two opt-in feed kinds, drawn
   (round B3 of the chats work, the integration round; jakob 2026-09-24).

   BOTH KINDS WERE DECLARED AND NEVER DRAWN. The feed's filter has listed
   `Chats` and `Messages` since its one list (`FEED_KINDS`), off by default; a
   reader who turns them on meets these cards. The trigger reads the kinds back
   as it always does — the filter's own summary, nothing added.

   THE CHAT CARD (`ChatFeedCard`) — the lane's anatomy from the card grammar,
   flagged: identity (the disc at 48px, the name as the title, the policy
   line), the description as a post's words stand, then LIVE-NESS — the member
   count and the last message's age, and the last message's own line, previewed
   as the explorer row previews it (`An encrypted message` where the reader
   holds no key) — then an action row of the opinion face and the join by the
   chat's policy. No score, no comment count, no share: a chat's rank is the
   feed's business and the Post score is a post's; its messages ARE the
   live-ness line; sharing a chat is not ruled. The head opens the chat.

   THE MESSAGE CARD (`MessageFeedCard`) — one message the rank surfaced, with
   its chat: `in {chat}` and the chat's disc first (the search row's
   indirect-hit words), the age ladder beside it, then the message in
   messenger clothes — a foreign bubble on the card, the sender's name and
   face — so a message out of its thread still reads as something said in a
   chat. The bubble keeps no clock: the exact time lives in the thread. The
   row is the opinion face and `Open in the chat`, which lands on the thread
   scrolled to the message. ONLY PLAINTEXT MESSAGES ARE CANDIDATES, the lane's
   reading, flagged: a feed reader mostly holds no key, and a card whose body
   is a no-key notice is a card about nothing.

   NO SECOND ALGORITHM. Both kinds rank by the ordinary rank, beside posts —
   a lineage as one candidate (chats.md §3), a message as the first-class
   content it is (§1).

   THE MIGRATION NOTE: the feed is canonical's (`Feed`), whose filter draws
   the two kinds as switches that change nothing drawn yet. At migration these
   cards join the feed's card set and this excerpt goes; the post below the two
   is this tree's own fixture standing for canonical's cards. */
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter value={{ kinds: ["posts", "chats", "messages"] }} />} />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 8, padding: "8px 0 0 0" }}>
        <ChatFeedCard
          name="Sea wall market"
          image="gallery-honey.jpg"
          policy="open"
          description="What's on the stands by the sea wall this week, and who is minding them."
          members={14}
          lastAge="35m"
          lastLine="Mira Voss: Honey is back on the stand from Saturday."
        />
        <MessageFeedCard chat="Slipway repairs" author={CHAT_JUNO} age="2h">
          Bring gloves — the new planks splinter. We start at the north end at nine.
        </MessageFeedCard>
        <PostCard {...SALT_MAPS_CURRENT} timestamp="3d" score="9.10" comments={2} />
      </div>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}

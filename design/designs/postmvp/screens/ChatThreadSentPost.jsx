/* A POST SENT INTO A CHAT, LANDED (round B3 of the chats work, the integration
   round; backlog item 23, ruled in 2026-09-24).

   A SENT POST IS A MESSAGE CITING THE POST. `Send to a chat` signed one Send
   into Coast walkers (chats.md §3) with a Reference from the new message to
   Mira's post, and the reader's optional words as its body. The bubble reads
   the citation back the way the cited round reads one back — as itself
   (`BubbleCitation`): the post's first picture as its 32px mark, the title,
   and whose it is. The whole block is a door to the post.

   CHAT SCALE, NEVER FEED SCALE: no card inside a bubble, no action row, no
   score — a thread of re-drawn post cards would read as a feed. And NO PAIR:
   a face beside a sent post would read as the sender's reaction to it; the
   citation's own low pair is read where every reference's is, the message's
   tags and references (the lane's call, flagged).

   A SENT POST WITH THE LOCK ON seals the words beside it and never the post:
   a Reference is an edge on the shared graph and has no payload to hide
   (chats.md §7). A no-key reader sees this same post block above the text
   notice. Stated here; the sheet says it where the choice is made.

   THE ANSWER UNDER IT is an ordinary message — Mira answering what she was
   sent. A foreign sent post wears the same block on the left. */
export function Screen() {
  return (
    <>
      <ChatThreadHeader name="Coast walkers" image="post-photo.jpg" />
      <ChatThreadColumn>
        <DayDivider>23 September</DayDivider>
        <ChatBubble author={CHAT_JUNO} when="08:05" sealed id="boots">
          I'll bring the spare boots — tell me your size.
        </ChatBubble>
        <ChatBubble author={CHAT_MIRA} when="08:40">
          Six it is. Meet at the harbour office.
        </ChatBubble>
        <ChatBubble own when="09:12">
          <BubbleCitation kind="post" name="Sunday at the tide market" src="gallery-market.jpg" sub="Mira Voss · a post" />
          <span>For after the walk — the stand's open till noon.</span>
        </ChatBubble>
        <ChatBubble author={CHAT_MIRA} when="09:20">
          Ha — that's my stand. Heather honey's on the left.
        </ChatBubble>
      </ChatThreadColumn>
      <ChatFoot />
    </>
  );
}

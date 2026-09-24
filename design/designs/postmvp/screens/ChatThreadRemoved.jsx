/* REMOVED MESSAGES — the author's own removal beside the platform's (round B3
   of the chats work, the integration round; round A docblocked the reader's
   own `Remove` on `ChatMessageMenu`, and this board draws what it leaves).

   A REMOVED MESSAGE IS A MARK WHERE ITS BUBBLE STOOD (`RemovedBubble`): on its
   own side, under its sender's name, at its own clock time, the transcript's
   order untouched. Removal takes the payload, never the record (erasure.md
   §1), so nothing vanishes and nothing is silent.

   THE TWO NEVER READ ALIKE — the standing honesty rule (readme §9, *Two
   reasons, two wordings*: collapsing them lets a verdict hide behind an
   author's decision):
   · THE READER'S OWN, removed by them this morning: `Removed by its author` —
     `Its place in the chat stays, and so do the replies to it.`
   · KEL'S, removed by a passed platform proposal: `Removed under the
     platform's rules` — `A passed proposal removed it. The decision is
     public.` — `RedactedContent`'s verdict mark, unchanged, because a
     verdict reads the same wherever it lands.
   Different first lines, different second lines, and neither shares a fill
   with a live bubble: both stand on the reserved surface a kept space wears.

   A REPLY KEEPS ITS DOOR. Mira answered the reader's message before it was
   removed; her quote now reads the mark's first line where the words were, and
   still scrolls to the mark.

   NOT DRAWN, AND WHY: the chat's own message disavowal
   (`decision:disavow_message`) removes nothing — the body stays and the
   chat's stance is the record (chats.md §6) — and stays deferred with the
   moderation slice. */
export function Screen() {
  return (
    <>
      <ChatThreadHeader name="Coast walkers" image="post-photo.jpg" />
      <ChatThreadColumn>
        <DayDivider>22 September</DayDivider>
        <ChatBubble author={CHAT_KEL} when="20:14" removed={{ reason: "illegal" }} />
        <ChatBubble own when="21:31" removed={{ reason: "author", note: REMOVED_MESSAGE_NOTE }} />
        <ChatBubble author={CHAT_MIRA} when="21:40" quote={{ name: "You", snippet: "Removed by its author" }}>
          Good to know — I'll bring the long boots then.
        </ChatBubble>
        <DayDivider>23 September</DayDivider>
        <ChatBubble author={CHAT_MIRA} when="08:40">
          Six it is. Meet at the harbour office.
        </ChatBubble>
      </ChatThreadColumn>
      <ChatFoot />
    </>
  );
}

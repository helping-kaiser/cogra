/* A JOIN REQUEST, MET BY SOMEONE WHO CAN APPROVE IT (round B2 of the chats
   work, the governance round; jakob 2026-09-23).

   THE PLACEMENT — the lane's call, flagged: BOTH, like every open decision. The
   request is a card in the thread at the moment it arrived, and the same
   request is a row under `Open decisions` on the details
   (`ChatDetailsDecisions`' grammar: the words a door to this card, `Approve`
   at the row's end). This board draws the thread, where a moderator meets it
   among the messages.

   `decision:add_member` UNDER THE DEFAULT MAP: eligibility `admin` or
   `chat_mod`, a plain count, one approver (chats.md §5). So the reader — a
   moderator here — settles it alone: `Approve` signs their approval on the tap
   (one record, the send arrow's precedent) and the card settles in place into
   `Sal Torres's request was approved`; what executes afterwards is the chat
   authority's, never in the reader's count (`ChatEditSeal`'s rule). Sal then
   joins by signing their own Participant (`ChatThreadApproved`,
   `ChatJoinSeal`). A plain member sees the same card with no act on it, and
   ignoring a request needs no record at all.

   THE CARD CARRIES NO COUNT: one approval settles it, and `0 of 1` is noise. A
   chat whose map asks for more approvers would count them like any card —
   `1 of 2 so far` — stated here, not drawn.

   THE REQUEST'S MESSAGE STANDS QUOTED UNDER THE SENTENCE — the Join Request's
   own payload (layer1-interface.md's act payload schema: "request message"),
   in the leave reason's grammar. NO DRAWN SURFACE WRITES IT YET: round A's
   `Ask to join` sends on one tap. Flagged for review.

   THE REQUESTER HAS NO DOOR ON THE CARD — the lane's reading, flagged: the card
   grammar carries no controls but its act, so an approver vets the requester by
   name; a door on the name to their profile is a one-line addition if wanted.

   THE CHAT IS HEADLAND HONEY — on request, the reader a moderator, muted on
   their list (muting silences push, not the thread). Its last message is Kel's
   about the jars, the list's preview; the request is newer than any message,
   and a decision is not a message, so the list's line does not change. */
export function Screen() {
  return (
    <>
      <ChatThreadHeader name="Headland honey" image="gallery-honey.jpg" />
      <ChatThreadColumn>
        <DayDivider>22 September</DayDivider>
        <ChatBubble author={CHAT_MIRA} when="16:20">
          The heather honey is nearly gone — six jars left.
        </ChatBubble>
        <ChatBubble author={CHAT_JUNO} when="16:48">
          Keep one back for me, please.
        </ChatBubble>
        <ChatBubble own when="17:05">
          Done — it's on the shelf under the till.
        </ChatBubble>
        <DayDivider>23 September</DayDivider>
        <ChatBubble author={CHAT_KEL} when="04:20">
          Jars are back on the stand from Saturday.
        </ChatBubble>
        <PendingCard quote="I keep two hives inland now — could I join and learn from yours?" act={<ApproveAct what="Sal Torres asks to join" />}>
          Sal Torres asks to join
        </PendingCard>
      </ChatThreadColumn>
      <ChatFoot />
    </>
  );
}

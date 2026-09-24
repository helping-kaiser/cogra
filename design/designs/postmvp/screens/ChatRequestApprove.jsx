/* A JOIN REQUEST, MET BY SOMEONE WHO CAN APPROVE IT (round B2 of the chats
   work, the governance round; jakob 2026-09-23, his fix pass 2026-09-24).

   THE PLACEMENT — the lane's call, flagged: BOTH, like every open decision. The
   request is a card in the thread at the moment it arrived, and the same
   request is a row under `Open decisions` on the details
   (`ChatDetailsDecisions`' grammar: the words a door to the decision,
   `Approve` at the row's edge). This board draws the thread, where a moderator
   meets it among the messages.

   `decision:add_member` UNDER THE DEFAULT MAP: eligibility `admin` or
   `chat_mod`, a plain count, one approver (chats.md §5). So the reader — a
   moderator here — settles it alone. `Approve` DOES NOT SIGN ON THE TAP (jakob
   2026-09-24: no misclicks): it opens the vote's small seal (`ChatAgreeSheet`,
   the nouns swapped — `You approve Sal Torres joining the chat.`, `Sign and
   approve`). Signed, the card settles in place into `Sal Torres's request was
   approved`; what executes afterwards is the chat authority's, never in the
   reader's count (`ChatEditSeal`'s rule). Sal then joins by signing their own
   Participant (`ChatThreadApproved`, `ChatJoinSeal`). A plain member sees the
   same card with no act on it.

   `Approve` STANDS ALONE, WITH NO `Disagree` BESIDE IT. A request under the
   default map is a count of approvals with no against: ignoring it is the no,
   and it needs no record (layer1-interface.md §9.8). The lane's reading,
   flagged.

   THE CARD CARRIES NO COUNT: one approval settles it, and `0 of 1` is noise. A
   chat whose map asks for more approvers would count them like any card —
   `1 of 2 so far` — stated here, not drawn.

   THE CARD'S WORDS OPEN THE DECISION WHOLE (`ChatDecisionDetail`'s anatomy):
   for a request, what would change is the requester's own person row — a door
   to their profile, which is where an approver vets them — with any approvals
   cast and the reader's own act.

   THE REQUEST'S MESSAGE STANDS QUOTED UNDER THE SENTENCE — the Join Request's
   own payload (layer1-interface.md's act payload schema: "request message"),
   in the leave reason's grammar. The composer that writes it is round B3's
   (jakob 2026-09-24).

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

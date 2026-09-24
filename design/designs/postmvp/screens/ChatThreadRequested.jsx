/* A CHAT YOU HAVE ASKED TO JOIN — the requester's thread once `Ask to join`
   is sent (round B2 of the chats work, the governance round; jakob
   2026-09-23). Round A left this moment as the join edge's terminal ("the
   request is sent and the foot says so"); this board draws it.

   TWO MOMENTS, TWO BOARDS — the lane's call, flagged. The brief allowed one
   board holding both the asked and the approved moment; it cannot do so
   honestly, because the two feet are different controls — this one has
   nothing to press, the approved one carries a `Join` with an edge of its own
   to the join's seal — and a docblocked button has no number to carry that
   edge. So the approved moment is its own board, `ChatThreadApproved`.

   THE REQUEST IS A CARD IN THE THREAD, AND THE FOOT SAYS IT IS SENT. A Join
   Request is a public record and a decision the chat takes (chats.md §4,
   *Joining*), so it stands in the transcript as the pending-card grammar has
   every open decision stand — worded for its author: `You asked to join`. It
   carries no count: under the default map one approval settles it
   (`decision:add_member`, 1 approver), and `0 of 1` is noise. The foot
   (`ChatJoinFoot`'s `requested` state) holds the persistent fact while the
   transcript scrolls — `Your request is sent — you can join once it's
   approved.` — and names no one who decides: governance ships silently. The
   card's words open the decision whole (`ChatDecisionDetail`'s anatomy), as
   every card's do.

   NO MESSAGE RIDES THIS REQUEST. Round A's `Ask to join` sends on one tap; the
   composer for the request's optional message (the Join Request's payload,
   layer1-interface.md's act payload schema) is round B3's (jakob 2026-09-24).
   `ChatRequestApprove` draws the message on the approver's side as the record
   can carry it.

   Withdrawing a request is not drawn: no record withdraws a Join Request in
   the docs.

   THE THREAD IS HARBOUR OFFICE (`HarbourOfficeThread`), `ChatThreadReader`'s
   chat — the one the reader asked to join there. */
export function Screen() {
  return (
    <>
      <ChatThreadHeader name="Harbour office" backLabel="Back to all chats" />
      <HarbourOfficeThread after={<PendingCard>You asked to join</PendingCard>} />
      <ChatJoinFoot state="requested" />
    </>
  );
}

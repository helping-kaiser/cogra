/* A VOTE, READ BACK BEFORE IT IS SIGNED — `Agree` on the kick card, over the
   thread (round B2 of the chats work, the governance round; jakob 2026-09-24:
   no vote signs on a bare tap — no misclicks).

   THE WHAT-YOU-SIGN GRAMMAR, COMPRESSED TO ONE VOTE (`VoteSheet`).
   `ChatSignSheet`'s title and the seal's "?", then ONE SENTENCE saying what the
   vote is, one quiet line saying it is public and can be changed, and the
   seal's button at full width with its verb naming the act. A vote is a single
   record, so no acts card: counting `1 thing` would be the only thing on it.
   It is a sheet, not a page, for `ChatSignSheet`'s reason — one record signed
   over the surface the reader is already looking at comes up and goes back
   down.

   ONE MASTER FOR EVERY VOTE, DRAWN ONCE. `Disagree` opens the same sheet with
   `You disagree that Kel Moreau should be removed from the chat.` and `Sign
   and disagree`; `Approve` on a join request (`ChatRequestApprove`) with `You
   approve Sal Torres joining the chat.` and `Sign and approve`; the decision
   page's change and take-back acts (`ChatDecisionDetail`) with the new
   direction's sentence, or `You take back your vote on …` and `Sign and
   withdraw`. The nouns swap; nothing else moves.

   WHAT IT SIGNS. One ballot in the reader's name (governance.md §3): positive
   for `Agree` and `Approve`, negative for `Disagree`, and the zero-direction
   ballot for a withdrawal. Changing a vote is simply a newer ballot — the
   tally reads each person's newest (api-spec.md, `prepareBallot`).

   SIGNED, the sheet goes down and the card reads `3 of 5 so far` with `You
   agreed` where the two words stood. Here that does not settle the kick — the
   reader weighs 1, and the fixture needs 5.2 cast.

   THE SURFACE BENEATH IS THE THREAD, whole and inert. */
export function Screen() {
  return (
    <>
      <ChatThreadDecisionsBody />
      <VoteSheet sentence="You agree that Kel Moreau should be removed from the chat." sign="Sign and agree" />
    </>
  );
}

/* A CHAT WITH DECISIONS IN IT — the pending-card grammar in one thread (round
   B2 of the chats work, the governance round; jakob's law 2026-09-23: nothing
   may look like a proposal; his fix pass 2026-09-24).

   THE CHAT IS SALT-CRUST RUBBINGS, where the reader is a plain member — the
   fixture's arithmetic, and why it could not be Coast walkers, is written once
   in the prelude over `SALT_CRUST`, with the tally law it obeys.

   FOUR FACES A DECISION WEARS, in one transcript, each at its own moment:
   · A CARD AWAITING THE READER'S VOICE — `Mira Voss wants to remove Kel Moreau
     from the chat`, `2 of 5 so far`, and the vote's two words at the end of
     the count's line: `Disagree` quiet, `Agree` filled. The count is the
     PEOPLE who agree: two of the five who have a say (Kel, the subject, has
     none — the map excludes him). Both words are real votes — a disagreement
     counts toward the quorum and against the share, and enough of them fail
     the decision (the prelude's tally law). Neither signs on the tap: each
     opens the vote's small seal (`ChatAgreeSheet`, the nouns swapped for
     `Disagree`). Once voted, the words give way to the quiet readout, as on
     the next card.
   · A CARD THE READER HAS VOTED ON — their own change to the chat's name,
     picture and description, one decision, `3 of 6 so far` and `You agreed`
     where the two words would stand: a proposer's agreement is signed with
     the proposal, so their own card is always in this state (`You disagreed`
     after a change of mind). A READOUT, NOT A BUTTON (jakob 2026-09-24): the
     whole card, words and readout, is the one door to the decision page,
     where changing and taking back the vote live. It stands at exactly half each
     way by role, so the next vote decides it — which only its page shows. It
     is where `ChatEditSeal`'s act lands when the map needs more voices than
     the reader's; a role change or a version's removal that waits lands the
     same way, worded by its own kind.
   · A PASSED OUTCOME — `Tobias Lindqvist is now a moderator`.
   · A FAILED OUTCOME — `The chat kept its name`: an earlier rename whose
     disagreeing side crossed first. Failed is final; asking again is a new
     decision.
   Outcome lines sit where their proposals were made; a kick that passes reads
   `Kel Moreau was removed`, one that fails `Kel Moreau stays in the chat`.

   EVERY CARD'S WORDS OPEN THE DECISION WHOLE (`ChatDecisionDetail`, jakob
   2026-09-24): the full proposed contents, every vote cast and which way,
   and the reader's own vote with the acts that change it. The card itself
   carries no arithmetic.

   CALM, NEVER LOUD. The cards stand on the page ground in a hairline — no
   fill a bubble uses, no colour, no icon, no bar filling towards a threshold.
   The filled `Agree` is the card's one strong mark, as the filled answer is a
   dialog's. No card carries a clock or a deadline: proposals never expire.

   WHAT A DECISION CARD NEVER SAYS: proposal, ballot, tally, quorum or weight.
   `Vote` is the reader's own word for what they cast, and the decision page
   uses it (`Votes`, `Your vote`) — jakob's word in the fix pass.

   MESSAGE DISAVOWAL IS DEFERRED to the moderation slice (jakob, the details
   round), and so is the surface that STARTS a kick — neither is drawn in this
   round. When they come they ride this same grammar: the chat distancing
   itself from a message is a card like Mira's, worded for a message, and
   settles into its own outcome line. A decision riding encrypted (chats.md §7:
   its text and ballots may be sealed while the anchor still publicly names
   the chat and the member) reads as drawn to a member; its face for a reader
   without the key is owed with the moderation slice.

   THE FOOT IS THE MEMBER'S FOOT, unchanged: the thread carries decisions
   without growing a second input. */
export function Screen() {
  return <ChatThreadDecisionsBody />;
}

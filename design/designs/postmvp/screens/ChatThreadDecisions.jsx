/* A CHAT WITH DECISIONS IN IT — the pending-card grammar in one thread (round
   B2 of the chats work, the governance round; jakob's law 2026-09-23: nothing
   may look like a proposal).

   THE CHAT IS SALT-CRUST RUBBINGS, where the reader is a plain member — the
   fixture's arithmetic, and why it could not be Coast walkers, is written once
   in the prelude over `SALT_CRUST`.

   THREE FACES A DECISION WEARS, in one transcript, each at its own moment:
   · A CARD AWAITING THE READER'S VOICE — `Mira Voss wants to remove Kel Moreau
     from the chat`, `2 of 5 so far`, and `Agree` at the end of the count's
     line. The count is PEOPLE: two of the five who have a say (Kel, the
     subject, has none — the map excludes him). Agreeing signs one record on
     the tap; the count reads `3 of 5 so far` and the act gives way to the quiet
     `You agreed` (stated, not drawn). Under the default map the reader's one
     voice does not carry it here; an admin's would, which is how a card can
     settle "early" — the count convention the prelude's charter flags.
   · THE READER'S OWN CARD — their rename, `1 of 6 so far`, count only: their
     own ballot was signed with the proposal, so there is nothing left to
     press. It is where `ChatEditSeal`'s act lands when the map needs more
     voices than the reader's, and a role change or a version's removal that
     waits lands the same way, worded by its own kind.
   · A SETTLED OUTCOME from earlier — `Tobias Lindqvist is now a moderator`, a
     quiet centred line at the moment its proposal was made, which is what a
     card becomes when its tally crosses. A kick that passes reads `Kel Moreau
     was removed`; a rename, `The chat is now called “Salt prints”`.

   CALM, NEVER LOUD. The cards stand on the page ground in a hairline — no
   fill a bubble uses, no colour, no icon, no bar filling towards a threshold —
   so the thread still reads as a conversation with two things in it waiting
   for more people. No card carries a clock or a deadline: proposals never
   expire.

   WHAT A DECISION CARD NEVER SAYS: proposal, ballot, vote, tally, quorum or
   weight. Geek mode paints the weighted arithmetic after each count (`cg-exact`
   — the prelude's `PeopleSoFar`), and a screen reader hears it in both modes.

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
  return (
    <>
      <ChatThreadHeader name="Salt-crust rubbings" />
      <SaltCrustThread />
      <ChatFoot />
    </>
  );
}

/* A CHAT YOUR REQUEST WAS APPROVED FOR — the requester's thread after a
   member approved it (round B2 of the chats work, the governance round; jakob
   2026-09-23). `ChatThreadRequested`'s second moment, drawn as its own board
   because its foot carries a control the first does not (that board's
   docblock).

   THE CARD HAS SETTLED INTO ITS OUTCOME LINE, in place: `Your request was
   approved`. An approval is not membership — proposals never participate
   (chats.md §4) — so the reader is still outside, and the foot offers the one
   act left to them: `Join`, filled, alone, because the line directly above it
   says why an on-request chat's foot now reads `Join` rather than `Ask to
   join`. The join opens its seal (`ChatJoinSeal`, the approved route's nouns:
   `Your request` · `Approved`), signing the Participant the approval now backs.

   REACHED BY OPENING THE CHAT AGAIN. The approval's notification row is round
   B3's (the kind does not exist yet); until then the requester meets this face
   when they next open the chat. */
export function Screen() {
  return (
    <>
      <ChatThreadHeader name="Harbour office" backLabel="Back to all chats" />
      <HarbourOfficeThread after={<DecisionOutcome>Your request was approved</DecisionOutcome>} />
      <ChatJoinFoot state="approved" />
    </>
  );
}

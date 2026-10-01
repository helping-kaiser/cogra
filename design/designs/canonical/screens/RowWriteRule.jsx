/* A HOLD THE WRITE RULE REFUSED (jakob 2026-10-01, closing the hold's
   vehicle backlog item 117 owed) — a reference plate, `RowSigning`'s
   sibling: the everyday feed drawn so the row can be read, wired nowhere.
   The shell's controls are `Feed`'s, and every hold edge in the graph names
   this plate for the write rule's outcome.

   THE ROW, IN THE NOTICE'S REGISTER. A hold has no surface to re-raise, so
   its outcome stands where the gesture was given — under the face, in the
   slot `Signing…` and the pending marker use. The write rule's refusal is a
   notice, not a fault, so the line is `SigningPending`'s `quiet` row form:
   `You can't sign right now.` in `--text-secondary`, announced politely, and
   never the failure voice `RowSigning`'s `That didn't sign.` wears.

   NO RETRY, AND THE FACE NEVER MOVED. Signed acts wait for their signature,
   so Tobias's post still wears the resting face of a reader with no opinion
   yet; nothing has to move back. Asking again at once meets the same answer,
   so the line ends without a word to press — gone, never disabled. The
   reader who wants to know why opens the pad, whose notice carries its own
   "?" (`PadWriteRule`).

   THE SECOND CARD IS THE FEED AS IT WAS, so the line reads against an
   ordinary row. */
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />} />
      <FeedList>
        <PostCard {...TOBIAS_POST} stanceSigning="writeRule" />
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}

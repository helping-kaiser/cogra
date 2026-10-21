/* AN EMPTY OPINION, ASKED — drawn 2026-10-21 (jakob's ruling, seam 242). A
   pick whose landing is exactly (0, 0) while nothing stands toward the target
   is not a walk-back: there is nothing to walk back. It is a priced record
   that says nothing and leaves the standing as it was, so it gets its own
   ask and never `SeveranceConfirm`'s.

   IT IS A PATTERN, SO IT SITS WITH THE PATTERNS, beside the walk-back it is
   told apart from: both are reached by Set on a pick that lands (0, 0), and
   only what stands beneath decides which one asks.

   THE FIRST-OPINION CASE IS WHAT IS DRAWN. @ada's profile, the reader holding
   no opinion of her — `ProfileOther`, whose anchor blooms `VouchBackPad`, the
   pad for a target nothing stands toward. That pad opens at +0.10 / +0.10
   with an empty bundle, so its pick IS its landing: dragged to exactly
   (0, 0), the landing is (0, 0) and Set asks here. The arithmetic reads
   straight through from that board's fixture. The other route — a bundle
   already walked back to nothing — raises the same dialog with the same
   words.

   THE ANCHOR BENEATH IS STILL THE EMPTY FACE. The ask has not signed, and
   when it does the standing does not move: `Your opinion` with 🫥 is what
   the profile shows before, during and after.

   THE SAFE ACTION IS THE FILLED ONE, as on the walk-back: `Keep it` in the
   right-hand slot returns to the pick still parked on the pad, and `Set it
   anyway` stays a text button on the left, one tap away — an ask, never a
   block. No `error` colour.

   THE PAD IS STILL OPEN BEHIND THE WASH, as `SeveranceConfirm`'s board
   explains: the dialog's scrim covers it, and the pad is drawn on its own
   board rather than a second time under a dim. */
export function Screen() {
  return (
    <>
      <ProfileOtherBody />
      <EmptySignConfirm targetLabel="@ada" />
    </>
  );
}

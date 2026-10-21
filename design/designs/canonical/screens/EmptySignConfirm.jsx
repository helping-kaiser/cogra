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

   THE ANCHOR BENEATH IS STILL THE EMPTY FACE: the ask has not signed. Once
   it does, the record joins the bundle like any other (jakob 2026-10-21) —
   the ordinary snackbar, and a standing at +0.00 / +0.00 that wears 🤷 and
   says nothing, with `Walk it back` there at its cost of 1.

   THE `context` CHIP DRAWS WHERE THE OPINION VOUCHES SOMEONE IN (jakob
   2026-10-21). On `ApprovePad` and `VouchAskPad` the same pick asks the same
   question, and `Set it anyway` still vouches them in — but the first line
   is the stronger warning: @rafa, on Invites, would start out cut off.
   `opinion` is @ada's profile, the ordinary ask.

   THE SAFE ACTION IS THE FILLED ONE, as on the walk-back: `Keep it` in the
   right-hand slot returns to the pick still parked on the pad, and `Set it
   anyway` stays a text button on the left, one tap away — an ask, never a
   block. No `error` colour.

   THE PAD IS STILL OPEN BEHIND THE WASH, as `SeveranceConfirm`'s board
   explains: the dialog's scrim covers it, and the pad is drawn on its own
   board rather than a second time under a dim. */
export const PROPS = { context: { editor: "enum", options: ["opinion", "vouchIn"], default: "opinion" } };
export const VALS = `opinionShown: this.props.context === "opinion" ? "contents" : "none", vouchInShown: this.props.context === "vouchIn" ? "contents" : "none"`;

export function Screen() {
  return (
    <>
      <div style={{ display: "{{opinionShown}}" }}>
        <ProfileOtherBody />
        <EmptySignConfirm targetLabel="@ada" />
      </div>
      <div style={{ display: "{{vouchInShown}}" }}>
        <InvitesBody />
        <EmptySignConfirm targetLabel="@rafa" vouchIn />
      </div>
    </>
  );
}

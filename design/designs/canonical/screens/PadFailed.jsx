/* THE PAD, AFTER A SIGNING THAT DID NOT GO THROUGH (the failure pack, jakob
   2026-09-30: a failed signed act re-raises its own surface, with Retry) —
   the pattern board for every pad's Set, the way `NetworkError` is for every
   seal's commit.

   SET WAITS FOR ITS SIGNATURE, SO THE PAD NEVER CLOSED. Past 200ms it read
   `Setting…` and went inert; the answer that came back was a fault, so the
   pad is exactly where it was: the same target, the same standing line, the
   knob still at the reader's pick, the landing line still reading what it
   would come to. Nothing the reader chose is lost.

   THE FAULT TAKES THE COMMIT'S PLACE — `NetworkError`'s grammar, at the
   pad's scale. `TransportError`'s line stands above the commit row in the
   seal's own words, and Set's slot becomes `Retry`, outlined because it is
   not a new commitment but the same one asked again. `Cancel` and the
   walk-away keep their places: the way out is the way out it always was.

   THE FIXTURE IS `PadStanding`'S, deliberately — @ada, one standing edge at
   +1.00 / +1.00, the pick pulling back to −0.55 / −0.15 — so the pair reads
   as one pad in two moments, and the shell beneath is the everyday feed for
   the reason given there.

   THE `moment` CHIP DRAWS THE WAIT BEFORE THE ANSWER, AND CANCEL IN IT (seam
   245, ask 16). `setting` is the pad past 200ms: `Setting…` in Set's slot,
   inert and never dimmed, the pick, the field and the landing line as they
   were — and `Cancel` live, because the pad is not the act. `cancelled` is
   that Cancel pressed: the pad closes, and the signing it sent goes on — a
   sent act cannot be called back — so its wait passes to the target's own
   row, `Signing…` under Ada's face in the pending marker's quiet register,
   the face still the standing's and the anchor refusing a second hold. It
   ends as a hold ends (`RowSigning`): signed, the face moves and the
   snackbar confirms; not signed, the row says `That didn't sign.` with a
   Retry that asks the same pick again. A press outside the pad and Escape
   do what Cancel does. `failed` is this board's own moment. */
export const PROPS = { moment: { editor: "enum", options: ["failed", "setting", "cancelled"], default: "failed" } };
export const VALS = `failedShown: this.props.moment === "setting" || this.props.moment === "cancelled" ? "none" : "block", settingShown: this.props.moment === "setting" ? "block" : "none", cancelledShown: this.props.moment === "cancelled" ? "block" : "none", washShown: this.props.moment === "cancelled" ? "none" : "block"`;

const PULLED_BACK = { pDirected: -0.55, pInterest: -0.15 };

export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />} />
      <FeedList>
        <div style={{ display: "{{failedShown}}" }}>
          <PostCard {...ADA_POST} bundle={mkBundle(1, 1)} stanceOpen stancePadInset={80} stanceDefaultPick={PULLED_BACK} stanceSigning="failed" />
        </div>
        <div style={{ display: "{{settingShown}}" }}>
          <PostCard {...ADA_POST} bundle={mkBundle(1, 1)} stanceOpen stancePadInset={80} stanceDefaultPick={PULLED_BACK} stanceSigning="busy" />
        </div>
        <div style={{ display: "{{cancelledShown}}" }}>
          <PostCard {...ADA_POST} bundle={mkBundle(1, 1)} stanceSigning="busy" />
        </div>
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />

      {/* The wash sits over the shell; the parked pad (fixed, above it) stays
          sharp. Cancelled, the pad is gone and so is its wash. */}
      <div aria-hidden="true" style={{ display: "{{washShown}}", position: "absolute", inset: 0, background: "var(--scrim-dialog)" }} />
    </>
  );
}

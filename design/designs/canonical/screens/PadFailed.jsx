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

   THE `moment` CHIP DRAWS THE WAIT BEFORE THE ANSWER, AND ITS WAY OUT
   (jakob 2026-11-11: Cancel and Close are the way out of a pad that
   stalls). `setting` is the pad past 200ms, the act not yet being sent:
   `Setting…` in Set's slot, inert and never dimmed, the pick, the field and
   the landing line as they were — and `Cancel` live, which truly cancels:
   the pad closes, nothing lands, Ada's row is untouched. `sending` is the
   same wait once the act is being sent: Set still reads `Setting…`, and the
   same button, in the same place, reads `Close`. `closed` is that Close
   pressed: the pad closes and the act, expected to happen, goes on, its
   wait carried by the target's own row — `Signing…` under Ada's face in the
   pending marker's quiet register, the face still the standing's and the
   anchor refusing a second hold. It ends as a hold ends (`RowSigning`):
   signed, the face moves and the snackbar confirms; not signed, the row
   says `That didn't sign.` with a Retry that asks the same pick again. A
   press outside the pad, Back and Escape do what the button does. `failed`
   is this board's own moment. */
export const PROPS = { moment: { editor: "enum", options: ["failed", "setting", "sending", "closed"], default: "failed" } };
export const VALS = `failedShown: this.props.moment === "failed" ? "block" : "none", settingShown: this.props.moment === "setting" ? "block" : "none", sendingShown: this.props.moment === "sending" ? "block" : "none", closedShown: this.props.moment === "closed" ? "block" : "none", washShown: this.props.moment === "closed" ? "none" : "block"`;

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
        <div style={{ display: "{{sendingShown}}" }}>
          <PostCard {...ADA_POST} bundle={mkBundle(1, 1)} stanceOpen stancePadInset={80} stanceDefaultPick={PULLED_BACK} stanceSigning="sent" />
        </div>
        <div style={{ display: "{{closedShown}}" }}>
          <PostCard {...ADA_POST} bundle={mkBundle(1, 1)} stanceSigning="sent" />
        </div>
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />

      {/* The wash sits over the shell; the parked pad (fixed, above it) stays
          sharp. Closed, the pad is gone and so is its wash. */}
      <div aria-hidden="true" style={{ display: "{{washShown}}", position: "absolute", inset: 0, background: "var(--scrim-dialog)" }} />
    </>
  );
}

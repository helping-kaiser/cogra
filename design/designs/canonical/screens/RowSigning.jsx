/* A HOLD, SIGNING — AND ONE THAT DID NOT SIGN (the failure pack, jakob
   2026-09-30: vehicle (b), the SigningPending-style line on the target's row,
   the Snackbar charter untouched). A reference plate, like `PadPending`: two
   states of the everyday feed drawn so the row can be read, wired nowhere —
   the shell's controls are `Feed`'s, and every hold edge in the graph names
   this plate for its failure.

   A HOLD HAS NO SURFACE TO RE-RAISE. A failed Set keeps its pad and a failed
   seal keeps its seal; a press-and-hold opens nothing, so the only place its
   fault can stand is where the gesture was given — the target's own row,
   under the face, in the slot the pending marker already uses (`PadPending`).
   A snackbar would have been the other place, and the Snackbar charter keeps
   it for confirmations only.

   THE FIRST CARD IS STILL SIGNING. Signed acts wait for their signature, so
   the face has not moved: Tobias's post still wears the resting face of a
   reader with no opinion yet. Past 200ms the row says `Signing…`, quiet, in
   the pending marker's register, and the anchor refuses a second hold until
   the answer comes. Signed, the face moves and the snackbar confirms, as it
   always has.

   THE SECOND CARD DID NOT SIGN. The reader's standing opinion of Ada's post
   is exactly what it was — the face never moved, so nothing has to move back.
   The row line is `SigningPending`'s `row` form: `That didn't sign.` in the
   failure voice, one of the three things `--error` may mean, and `Retry` as
   the bare word ending it, which asks the same hold again. It is short
   because the row is one line of controls by rule.

   THE THIRD CARD IS A COMFORT THAT FAILED (the failure pack: "a comfort
   that fails reverts and says so in the same place"; jakob 2026-10-01,
   backlog item 117). Save, unsave, hide, undo and unhide answer at the tap;
   when the answer is no, the change reverts — here Sol's post, saved from
   its menu, is unsaved again — and the row under the face says `That didn't
   go through.` in the failure voice with `Retry`, which asks the comfort
   again, never a signature. The face never moved, because a comfort is not
   an opinion. The plate grows to hold the third card.

   THE `hold` CHIP DRAWS THE MOMENT BEFORE (the K13 round): `holding` puts
   the first card a moment earlier — the finger still down on Tobias's face,
   300 of the 500ms gone — and the ring around the face stands three-fifths
   full, `primary`, clockwise from twelve o'clock. Lift before it closes and
   nothing spends; let it close and the card is the `signing` state this
   board draws by default. */
export const FRAME = { width: 390, height: 1600 };
export const PROPS = { hold: { editor: "enum", options: ["signing", "holding"], default: "signing" } };
export const VALS = `holdShown: this.props.hold === "holding" ? "block" : "none", signShown: this.props.hold === "holding" ? "none" : "block"`;

export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />} />
      <FeedList>
        <div style={{ display: "{{holdShown}}" }}>
          <PostCard {...TOBIAS_POST} stanceHoldProgress={0.6} />
        </div>
        <div style={{ display: "{{signShown}}" }}>
          <PostCard {...TOBIAS_POST} stanceSigning="busy" />
        </div>
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} stanceSigning="failed" />
        <PostCard {...SOL_POST} stanceSigning="comfortFailed" />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}

/* THE STAGED CITATION'S PAIR EDITOR (jakob's ruling 2026-09-10). What a staged
   reference row opens in a composer — the sheet that closes item 18's remaining
   half, the one the tag round left standing.

   IT IS THE PAD, NOT TWO SLIDERS, and that is the whole difference from
   `TagPair`. A citation's two user parameters are BOTH signed: `ReferenceInput`
   (api-spec.md) gives relevance `[-1, 1]` and support `[-1, 1]`, where a Tag's
   confidence is census-bounded to `[0, 1]`. The pad is one square over two
   signed axes, so a tag would have to hang half of it dead; a citation fills it
   exactly. The instrument follows the census, not the surface.

   THE POLES ARE THE CITATION'S, IN THE SLOTS THE CONTRACT ASSIGNS. Relevance
   occupies `pDirected` — the pad's horizontal — and asks how much this post
   leans on what it cites: `Barely` to `Entirely`, the two words `TagPair`
   already uses for the same slot. Support occupies `pInterest` — the vertical —
   and is endorsing against refuting, so `Against` and `For` ride there. Those
   two words sit on the horizontal when the pad carries a stance; the rotation
   is the contract's doing, not a choice, and the pad names its poles on the
   field precisely so a reader never has to remember which axis is which.

   THE DEFAULTS ARE THE CONTRACT'S, +0.1 ON BOTH. `ReferenceInput` says why they
   are strictly positive: a default mention vouches, weakly, at coefficient
   `√0.01 = 0.1`. So the knob opens just off centre in the for-it quadrant, not
   at the origin.

   THE FACE RIDES THE PAIR (jakob's ruling, 2026-09-10). Wherever a pair is
   being set, its readout carries the nearest anchor's face beside the exact
   numbers: the face is the quickest rough read of where the knob currently
   sits, and the numbers under it carry the fact for anyone who wants it. The
   citation's two axes fill the two slots the contract assigns — relevance
   `pDirected`, support `pInterest` — so the lookup is `STANCE_ANCHORS`
   unchanged, and at +0.10 / +0.10 the nearest row is 🙂 (0.15 / 0.15). It is
   spelled here for `ComposePad`'s reason: `nearestAnchor` is not among the
   names the bundle exposes to screens, and a board must never name a face the
   system has no row for. The numbers carry `cg-exact` exactly as the master's
   do, so a hand-drawn readout follows the reading mode instead of diverging
   from it (readme §13).

   THE ANCHOR'S WORD DOES NOT COME WITH IT. The face is a lossy readout and
   survives the change of family; the word beside it names a feeling about a
   stance, and this record is a citation, so the spoken reading names the two
   axes and their values instead. Nothing is taken from a reader who cannot see
   the face — the pair it approximates is spoken exactly.

   THE READOUT STANDS ABOVE THE FIELD, because a thumb on the pad covers
   exactly the spot where feedback would otherwise appear.

   `Done` CLOSES IT, and the scrim is the way out that keeps nothing —
   `TagPair`'s grammar, because this is the same gesture on the same kind of
   surface: a sheet titled by the thing it edits, committing on close. Nothing
   is signed here either; the pair rides the citation's own record and the
   citation rides the composer's batch, so this sheet stages and the seal signs.

   THE SURFACE BENEATH IS DRAWN WHOLE (`ComposeDetailsBody`), the overlay rule
   from 2026-09-08: a sheet covers the surface the reader came from, and that
   surface is the real one, not a shortened stand-in of it. The reply's seal
   opens this same sheet — a comment's citation is a post's citation — the way
   it borrows the license and sensitive sheets from the compose page. */

/* The four poles, named for the record family that fills the slots. */
const CITATION_AXES = { left: "Barely", right: "Entirely", bottom: "Against", top: "For" };

const SR_ONLY = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

export function Screen() {
  return (
    <>
      <ComposeDetailsBody />

      <BottomSheet open ariaLabel="The long way home — @ada">
        <SheetTitle>The long way home — @ada</SheetTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "0 24px 4px" }}>
          {/* The pick's readout, in the pad's own block shape: the name of the
              quantity, then the face and the exact pair on the line below it.
              `aria-hidden` beside a screen-reader reading that names both axes —
              the numbers alone say nothing about which slot they fill, and the
              anchor's own word would name a stance this record is not. */}
          <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span
              aria-hidden="true"
              style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", fontWeight: "var(--text-label-small--font-weight)", letterSpacing: "var(--text-label-small--letter-spacing)", color: "var(--text-secondary)" }}
            >
              Your pick
            </span>
            <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "baseline", gap: "var(--space-2)" }}>
              <span style={{ fontSize: "var(--text-title-large)", lineHeight: 1.2 }}>🙂</span>
              <span className="cg-exact" style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", whiteSpace: "nowrap" }}>
                +0.10 / +0.10
              </span>
            </span>
            <span style={SR_ONLY}>Your pick: How much it leans on this +0.10, For or against +0.10</span>
          </div>

          <div role="group" aria-label="The pair this citation signs" style={{ alignSelf: "center", width: 240 }}>
            <StancePad value={{ pDirected: 0.1, pInterest: 0.1 }} axes={CITATION_AXES} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid var(--border-hairline)", paddingTop: 10 }}>
            <span style={{ flex: 1, fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", letterSpacing: "var(--text-body-small--letter-spacing)", color: "var(--text-secondary)" }}>
              Signed with the post, as its own action.
            </span>
            <Button>Done</Button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}

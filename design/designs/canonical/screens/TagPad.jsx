/* THE STAGED TAG'S PAIR EDITOR, ON AN EDIT (jakob's rulings 2026-09-10 and
   2026-09-11). What a staged tag chip opens on a post being edited — the sheet
   that closes item 18's compose-side pair setting for tags. `TagPadCompose` is
   the same sheet on the composers, where nothing has been signed yet and so
   there is nothing to withdraw.

   IT IS THE PAD. A tag's two user parameters are aboutness and certainty, and
   the author sets both at once, so the instrument is one field rather than two
   tracks: a pair is a place, and a place is picked in one gesture. The pad's
   two slots take the contract's own: relevance in `pDirected`, the horizontal,
   and confidence in `pInterest`, the vertical (`TagInput`, api-spec.md).

   CONFIDENCE RUNS 0 TO 1, AND RELEVANCE STARTS JUST ABOVE NOTHING. Confidence
   is census-bounded to `c ∈ [0, 1]` (hashtag.md §4), and the composer authors
   only the positive half of relevance — an author saying what their own post
   is about says how much, never how much it is not. The square is the
   reachable square, corner to corner, and `StancePad` takes the bound as
   `ranges` the way it already takes the poles as `axes`: the control owns the
   geometry, the census owns how far each slot reaches.

   THE POLES ARE NAMED ON THE FIELD, in the reader's words. Aboutness runs
   `Barely` to `Entirely` — the two words a citation's relevance uses for the
   same slot — and certainty runs `Guessing` up to `Certain`. §3 keeps `p_d`,
   `p_i` and the repo's internal vocabulary off the screen, and the four pole
   words are the only place this sheet could smuggle them in.

   THE FACE IS THE TAG'S OWN, AND THE TABLE IS DISJOINT FROM THE STANCE FACES.
   Wherever a pair is being set its readout carries the nearest anchor beside
   the exact numbers, but a tag has no mood to wear: it is a claim about what a
   post is about, so its thirteen anchors are objects rather than faces — a key,
   a magnet, a die. Not one glyph is shared with `STANCE_ANCHORS`, which is what
   keeps a single lossy readout from meaning two things. It is spelled here for
   `RefPair`'s reason: the lookup is not among the names the bundle exposes to
   screens, and a board must never name a face the system has no row for. At the
   contract's default the nearest row is 🔍 (0.15 / 0.90).

   THE ANCHOR'S WORD DOES COME WITH IT, unlike a citation's. A citation borrows
   the stance table, whose words name a feeling about a stance the record is
   not; these words were written for this table and say what the pair claims, so
   the spoken reading carries the word and the two axes both.

   THE DEFAULTS ARE THE CONTRACT'S, +0.1 AND 1. `TagInput` gives relevance the
   low-defaults value and confidence 1, and says why: an author believes their
   own declaration, and confidence is not a stance whose headroom needs
   preserving. A stance starts gentle because it will be added to; a declaration
   about your own post does not need room to grow. The sheet opens where the
   reader arrives rather than at a value chosen to flatter the control.

   THE READOUT STANDS ABOVE THE FIELD, because a thumb on the pad covers exactly
   the spot where feedback would otherwise appear.

   IT IS TITLED BY THE TAG IT EDITS, for the settings sheets' reason — a sheet
   that covers the surface it came from has to say what it is — and the tag is
   what the reader tapped, so the two cannot drift.

   `Done` CLOSES IT, and the scrim is the way out that keeps nothing. Nothing is
   signed here: the pair rides the tag's own record and the tag rides the
   composer's batch, so this sheet stages and the seal signs.

   `Un-tag` IS ITS OWN GESTURE (jakob's rulings, 2026-09-11). Taking a tag off
   a post that carries it is a record like adding one, which is why the body's
   `Withdrawn:` line names the result and the acts sheet counts it — the
   control speaks the reader's word (api-spec's own noun for the r-0 record is
   "the un-tag") and the record-speak stays the register's. An act of that
   weight is asked for by a control that says what it does, never by dragging
   a claim down to nothing. It takes `Sever`'s place on the stance pad — the
   walk-away pushed left, the decisions kept right — and `Sever`'s restraint
   with it: a text button and no colour of its own, because a withdrawal is a
   deliberate act and not a failure (§2.4). THE CHIP'S × DOES THE SAME AT AN
   EDIT, without the pad roundtrip: a reader who just wants the tag gone taps
   the ×, and the same staged withdrawal lands — two doors, one act, neither
   asking twice.

   IT STAGES, AND THE SEAL SIGNS. The sheet closes, the chip leaves the row, and
   what stands in its place is the `Withdrawn:` line the edit body already
   carries — one more action for the acts card, which the edit seals together
   with everything else (item 37). Nothing asks twice. The seal is the willing
   act, and a confirmation over a change that is staged and reversible would be
   a second layer guarding nothing.

   THE WITHDRAWAL IS NOT ON THE FIELD (jakob's ruling, 2026-09-11). Un-tagging
   is re-tagging at relevance 0 — an ordinary priced, visible record and never
   an erasure (hashtag.md §4) — which is a different act from weakening a
   claim, not the far end of one. So the field floors just above nothing and
   carries claims alone: no drag can turn into an un-tagging, and there is no
   edge to warn about. The floor makes the left pole true as well — `Barely` is
   a fair reading of the lowest value the field offers, and never was one of
   zero.

   THE SURFACE BENEATH IS DRAWN WHOLE (`EditComposeBody`), the overlay rule from
   2026-09-08: a sheet covers the surface the reader came from, and that surface
   is the real one, not a shortened stand-in of it. */

/* The four poles, named for the record family that fills the slots. */
const TAG_AXES = { left: "Barely", right: "Entirely", bottom: "Guessing", top: "Certain" };

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
      <EditComposeBody />

      <BottomSheet open ariaLabel="#saltmaps">
        <SheetTitle>#saltmaps</SheetTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "0 24px 4px" }}>
          {/* The pick's readout, in the pad's own block shape: the name of the
              quantity, then the face and the exact pair on the line below it.
              `aria-hidden` beside a screen-reader reading that carries the
              anchor's word and names both axes — the numbers alone say nothing
              about which slot they fill. */}
          <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span
              aria-hidden="true"
              style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", fontWeight: "var(--text-label-small--font-weight)", letterSpacing: "var(--text-label-small--letter-spacing)", color: "var(--text-secondary)" }}
            >
              Your pick
            </span>
            <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "baseline", gap: "var(--space-2)" }}>
              <span style={{ fontSize: "var(--text-title-large)", lineHeight: 1.2 }}>🔍</span>
              <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", whiteSpace: "nowrap" }}>
                +0.10 / 1.00
              </span>
            </span>
            <span style={SR_ONLY}>
              Your pick: had to look, but it&apos;s in there. How much it is about this +0.10, How sure you are 1.00
            </span>
          </div>

          <div role="group" aria-label="The pair this tag signs" style={{ alignSelf: "center", width: 240 }}>
            <StancePad value={{ pDirected: 0.1, pInterest: 1 }} axes={TAG_AXES} ranges={TAG_RANGES} />
          </div>

          {/* The line carries both outcomes — a pair set and a tag withdrawn
              are each signed with the post, as their own action — so it stands
              over the row rather than beside `Done`, leaving the left slot for
              the walk-away the stance pad's action row puts there. */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid var(--border-hairline)", paddingTop: 10 }}>
            <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", letterSpacing: "var(--text-body-small--letter-spacing)", color: "var(--text-secondary)" }}>
              Signed with the post, as its own action.
            </span>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "var(--space-2)" }}>
              <Button variant="text" style={{ marginRight: "auto" }}>Un-tag</Button>
              <Button>Done</Button>
            </div>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}

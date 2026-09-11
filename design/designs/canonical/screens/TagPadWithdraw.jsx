/* THE TAG PAD WITH THE PICK AT THE WITHDRAWAL (jakob's ruling 2026-09-10).
   `TagPad`'s sheet with relevance dragged to nothing — the one state on this
   field that does not merely weaken a claim but ends it.

   RELEVANCE 0 IS THE WITHDRAWAL, and the contract says so: un-tagging is
   re-tagging at relevance `r = 0`, an ordinary priced, visible record and never
   an erasure (hashtag.md §4). The value is reachable on the pad because it is
   the axis's own end, so a reader can land on it by dragging, and what lands
   there is not a weak tag but no tag at all.

   SO THE PAD INFORMS, AND DOES NOTHING ELSE. It does not clamp the knob short
   of the edge — a control that refuses a value the record accepts lies about
   the range, and the reader would be left dragging at a wall with no account of
   why. It does not withdraw on the spot either: nothing on this sheet signs,
   and a gesture whose meaning changes silently at one end of a track is the
   trap §9 exists to refuse. It says what signing would do, and the reader
   decides.

   THE WARNING SITS WITH THE READOUT, not in the foot and not under the field.
   The readout is the thing that changed, so it is where the eye already is, and
   it is above the field where a thumb cannot cover it. The foot's line is
   unchanged and still true: a withdrawal is signed with the post like any other
   act, which is exactly what keeps it from being an erasure.

   THE TABLE DOES NOT SPEAK FOR THE WITHDRAWAL. `TAG_ANCHORS` reads a pair as a
   degree of aboutness held at a degree of certainty, and a withdrawn tag claims
   no aboutness at all — the nearest row would have the sheet saying "had to
   look, but it's in there" beside a line that says the tag is being
   disconnected. So the face drops and the exact pair stays, the way a stance
   bundle standing at the origin never speaks through `STANCE_ANCHORS` either.
   Nothing is taken from a reader who cannot see the face: the spoken reading
   carries the warning and both values.

   THE × ON THE CHIP IS STILL THE UN-TAG. This is what the pad says when a pick
   happens to land on the withdrawal, not a second way to ask for one. */

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
          <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-1)" }}>
            <span
              aria-hidden="true"
              style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", fontWeight: "var(--text-label-small--font-weight)", letterSpacing: "var(--text-label-small--letter-spacing)", color: "var(--text-secondary)" }}
            >
              Your pick
            </span>
            <span aria-hidden="true" style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", whiteSpace: "nowrap" }}>
              +0.00 / 1.00
            </span>
            {/* No `error` colouring — §9's rule for every honesty surface. The
                step from `onSurfaceVariant` to `onSurface` is what marks it,
                the same step the pad's own pick readout already makes. */}
            <span aria-hidden="true" style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", textAlign: "center", color: "var(--on-surface)" }}>
              Nothing about it — signing this disconnects the tag.
            </span>
            <span style={SR_ONLY}>
              Your pick: nothing about it — signing this disconnects the tag. How much it is about this +0.00, How sure you are 1.00
            </span>
          </div>

          <div role="group" aria-label="The pair this tag signs" style={{ alignSelf: "center", width: 240 }}>
            <StancePad value={{ pDirected: 0, pInterest: 1 }} axes={TAG_AXES} ranges={TAG_RANGES} />
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

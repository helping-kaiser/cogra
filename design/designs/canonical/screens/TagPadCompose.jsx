/* THE STAGED TAG'S PAIR EDITOR, ON A COMPOSER (jakob's ruling, 2026-09-11).
   `TagPad`'s twin on the creation path: the same sheet, the same field, the
   same floor and the same readout, over a post being written rather than one
   being edited.

   THE ONE DIFFERENCE IS THE FOOT, AND IT IS A DIFFERENCE OF FACT. Nothing on
   this path has been signed yet, so there is no tag to withdraw — a staged tag
   is a line in a draft, and taking it back out costs nothing and leaves no
   record. `TagPad` carries `Withdraw` because an edit's tag already stands and
   removing it is an act; here the same control would name an act that does not
   exist.

   SO THE × ON THE CHIP IS THE WHOLE OF IT. `TopicRemovable` already spells the
   two gestures apart — the pill opens this sheet, the × takes the tag back out
   — and on a composer the × is instant unstaging with no layer over it. The
   sheet is for the pair; the row is for whether the tag is there at all.

   EVERYTHING ELSE IS `TagPad`'s, and deliberately so: the poles, the thirteen
   anchors and their words, the contract's +0.1 and 1, the readout above the
   field where a thumb cannot cover it, the title taken from the tag that was
   tapped. Two boards exist because two contexts reach this sheet with
   different controls, not because the sheet drifts between them — read
   `TagPad` for the reasoning behind every part they share.

   THE SURFACE BENEATH IS DRAWN WHOLE (`ComposeDetailsBody`), the overlay rule
   from 2026-09-08: a sheet covers the surface the reader came from, and that
   surface is the real one, not a shortened stand-in of it. */

/* The four poles, named for the record family that fills the slots. */
const TAG_AXES = { left: "Barely", right: "Entirely", bottom: "Guessing", top: "Certain" };

export function Screen() {
  return (
    <>
      <ComposeDetailsBody />

      <BottomSheet open ariaLabel="#coastroad">
        <SheetTitle>#coastroad</SheetTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "0 24px 4px" }}>
          <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span
              aria-hidden="true"
              style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", fontWeight: "var(--text-label-small--font-weight)", letterSpacing: "var(--text-label-small--letter-spacing)", color: "var(--text-secondary)" }}
            >
              Your pick
            </span>
            <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "baseline", gap: "var(--space-2)" }}>
              <span style={{ fontSize: "var(--text-title-large)", lineHeight: 1.2 }}>🔍</span>
              <span className="cg-exact" style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", whiteSpace: "nowrap" }}>
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

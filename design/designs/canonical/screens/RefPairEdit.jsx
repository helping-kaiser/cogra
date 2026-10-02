/* A STANDING CITATION'S PAIR, ON AN EDIT (jakob's ruling, the night batch
   2026-10-01 — audit K5.3, "as recommended" with his sharpening). What a
   citation row opens on a post being edited: the citation already stands, so
   this is not `RefPair`, the sheet of a citation not yet signed.

   A CITATION'S RECORDS NET (`ReferenceClaim`, api-spec.md): a citation revised
   twice folds to the sum of all three records, clipped to the census range.
   So the pick here is ONE ADDITIVE RECORD — one more record added to what
   stands — and never an absolute target the client would have to reach with
   records of its own. That is the stance pad's arithmetic exactly, so it is
   read back the stance pad's way, in three readouts formatted alike: `Current`
   (the citation's fold as it stands), `Your pick` (the record this sheet
   stages) and, under the field, `Resulting` (the fold once it lands). The
   masters draw all three (`StanceStanding`, `StanceLandingLine`); the family
   object below names the two bundle labels for a record that is not an
   opinion and keeps the anchor's word out of the spoken readings, `RefPair`'s
   rule — the faces are the stance table's, a lossy readout and nothing more.

   THE PICK OPENS AT THE ORIGIN, as the stance pad's does: what it adds is
   what the reader drags, and a pick that opened at the contract's default
   +0.10 / +0.10 would add a mention's worth to a citation that already has
   one. The board draws it moved, so the three readouts differ. `Done` on a
   pick never moved off the origin closes the sheet staging nothing, as the
   scrim does: an untouched pad never makes an act (jakob 2026-10-02, pads
   4).

   `Remove citation` IS ITS OWN GESTURE, `TagPad`'s `Un-tag` said for this
   family: the walk-away pushed left of `Done`, a text button, no colour of its
   own. A withdrawal is the severance shape — the counter-records that net the
   bundle to (0, 0), each its own priced act (`PrepareReferenceWithdrawalInput`)
   — so it is a different act from weakening the citation, never the far end
   of a drag.

   ITS COST IS SAID INLINE, AND SIGN IS THE CONFIRMATION (jakob: no second
   dialog). The line over the foot says what removing costs, in the walk-back's
   own words, and the control's accessible description is that line. There is
   no confirm on this sheet: the removal stages, the row leaves `References` for
   the body's `Withdrawn:` line with its `Undo`, the acts card counts it, and
   the edit's Sign is the willing act — api-spec's "asks for confirmation first
   and prepares only once the author has agreed", answered by the seal.

   THE COUNT IS THE REAL COUNTER-RECORD COUNT, NEVER "1 PER REMOVAL" (jakob,
   verbatim in the audit record: a bundled connection with a magnitude over 1
   on any dimension needs MULTIPLE counter-acts). It is
   `ReferenceClaim.withdrawalCost` — how many counter-records withdrawing
   stages right now, served because the clipped pair beside it cannot answer
   how far past 1 the raw sums reach. A citation revised upward past 1 on
   either axis says `Removing it signs 3 things, each paid separately.`; this
   one, a single mention, says the singular. The acts card and the footer
   count the same number.

   A CITATION THIS APP CANNOT TYPE IS NOT EDITABLE (api-spec: "Clients exclude
   such citations from editing"). Its row on the edit carries no × and opens
   nothing, so it never reaches this sheet; its note reads `Comes along as it
   is.`

   THE NON-DRAG ROUTE IS `RefPair`'s (audit K10.1): `Set exact values for The
   long way home — @ada`, the sheet's first control, hidden until focused and
   where focus lands on open, swaps the field for the two tracks in place;
   both readout groups are `aria-live`.

   THE SURFACE BENEATH IS DRAWN WHOLE (`EditComposeBody`), the overlay rule from
   2026-09-08; the sheet takes the raised height class, because three readouts,
   the field and the foot need the room. */

/* The citation's family: the four poles and two questions `RefPair` names, and
   the two bundle labels a record that is not an opinion reads under. */
const CITATION_FAMILY = {
  directed: "How much it leans on this",
  interest: "For or against",
  left: "Barely",
  right: "Entirely",
  bottom: "Against",
  top: "For",
  current: "Current",
  resulting: "Resulting",
  anchorWord: false,
};

/* The citation as it stands — one mention at the contract's default — the
   record this sheet stages, and the fold once it lands. */
const CURRENT = { pDirected: 0.1, pInterest: 0.1 };
const PICK = { pDirected: 0.2, pInterest: 0.1 };
const RESULTING = { pDirected: 0.3, pInterest: 0.2 };

export function Screen() {
  return (
    <>
      <EditComposeBody />

      <BottomSheet open ariaLabel="The long way home — @ada" maxHeight="88%">
        <SheetTitle>The long way home — @ada</SheetTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 24px 4px" }}>
          <button type="button" className="cg-sr-focusable cg-state cg-focus cg-hit" style={{ fontFamily: "var(--font-sans)" }}>
            Set exact values for The long way home — @ada
          </button>

          <StanceStanding
            pick={PICK}
            bundle={{ current: CURRENT, rawSum: CURRENT, records: 1, severed: false }}
            targetLabel="The long way home — @ada"
            names={CITATION_FAMILY}
          />

          <div role="group" aria-label="The pair this citation signs" style={{ alignSelf: "stretch" }}>
            <StancePad value={PICK} axes={CITATION_FAMILY} />
          </div>

          <StanceLandingLine landing={{ landing: RESULTING, inert: false, severed: false }} names={CITATION_FAMILY} />

          <div style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid var(--border-hairline)", paddingTop: 10 }}>
            <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", letterSpacing: "var(--text-body-small--letter-spacing)", color: "var(--text-secondary)" }}>
              Signed with the post, as its own action.{" "}
              <span id="refpair-edit-removal-cost">Removing it signs 1 thing, paid on its own.</span>
            </span>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "var(--space-2)" }}>
              <Button variant="text" describedBy="refpair-edit-removal-cost" style={{ marginRight: "auto" }}>
                Remove citation
              </Button>
              <Button>Done</Button>
            </div>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}

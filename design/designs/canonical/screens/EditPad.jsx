/* THE PAD OVER A POST EDIT (jakob 2026-10-16, PR-101): what the edit's `Your
   backing` row's `Adjust` opens. The wash covers the edit; only the parked pad
   is live, which is what the board's `scanExempt` line says.

   IT IS THE COMPOSE PAD'S ONE AXIS. An edit is an ordinary-role Publish
   toward the post — the family that minted it — so its record carries the
   same one free parameter, the author's backing, with the second pinned at 1
   by the census. The field is `AttachmentPad`; what the author thinks of the
   post is the ordinary opinion its face takes, a bundle of its own.

   THE PICK IS THE EDGE (jakob 2026-10-16: "you add an edge with what you set
   and you get the readout of what you are setting and what this will result
   in"). The strip collects the edit's own record — 0.00 by default, which
   changes the backing by nothing and is a perfectly ordinary edit. The
   readouts say what is newly set and what it comes to: `Current backing`, the
   bundle's net now, over `Your pick` (`AttachmentStanding`), and `Backing
   after` beneath the strip (`AttachmentLandingLine`) — `clip` of the raw sum
   plus the pick, the total and the cap stated when the sum passes ±1. Every
   pick on the strip is legal. The board draws the pick moved, `RefPairEdit`'s
   reason: unmoved, the after would repeat the current.

   ONLY THE WALK-BACK AIMS AT A RESULT. `Walk it all back` stands where the
   ordinary pad keeps its walk-away, on the left of the commit row: it parks
   the pick at the raw sum's opposite, clipped to the strip, so Set lands the
   backing at 0.00 — or, past ±1, as far as one record reaches, the rest
   another edit's. It is greyed while the backing already nets 0.00. It parks
   a pick; Set still signs, so no dialog stands between them.

   SET STAGES, IT NEVER SIGNS — the seal-scale pads' grammar (`ComposePad`,
   `ReplyPad`). Set closes the pad onto the edit, the row reading the backing
   after; `Sign the edit` signs it with the rest of the batch, inside the
   edit's own record, so the count does not move. Cancel and the scrim stage
   nothing.

   THE SURFACE BENEATH IS DRAWN WHOLE (`EditComposeBody`), the overlay rule
   from 2026-09-08. */
const RAW_SUM = 0.1;
const PICK = 0.3;

export function Screen() {
  return (
    <>
      <EditComposeBody />

      {/* The wash over the shell; the parked pad above it stays sharp. */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--scrim-dialog)" }} />

      <div
        style={{
          position: "absolute",
          left: 30,
          right: 30,
          bottom: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          borderRadius: "var(--radius-extra-large)",
          background: "var(--surface-dialog)",
          color: "var(--on-surface)",
          padding: "var(--card-padding)",
          boxSizing: "border-box",
        }}
      >
        <span style={{ position: "absolute", top: 4, right: 4 }}>
          <HelpDot ariaLabel="Your backing on your post" />
        </span>

        <AttachmentStanding current={RAW_SUM} pick={PICK} style={{ paddingRight: 40 }} />

        <div role="group" aria-label="Backing pad for your own post" style={{ alignSelf: "stretch" }}>
          <AttachmentPad value={PICK} />
        </div>

        <AttachmentLandingLine rawSum={RAW_SUM} pick={PICK} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="text" size="sm" style={{ marginRight: "auto" }}>Walk it all back</Button>
          <Button variant="text" size="sm">Cancel</Button>
          <Button size="sm">Set</Button>
        </div>
      </div>
    </>
  );
}

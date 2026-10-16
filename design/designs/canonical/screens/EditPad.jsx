/* THE PAD OVER A POST EDIT (jakob 2026-10-16, PR-101): what the edit's `Your
   opinion` row's `Adjust` opens. The wash covers the edit; only the parked pad
   is live, which is what the board's `scanExempt` line says.

   IT IS THE COMPOSE PAD'S ONE AXIS. An edit is an ordinary-role Publish
   toward the post — the family that minted it — so its record carries the
   same one free parameter, the author's attachment, with the second pinned at
   1 by the census. The field is `AttachmentPad`; what the author thinks of
   the post is the ordinary opinion its face takes, a bundle of its own.

   THE PAD SPEAKS IN THE RESULTING VALUE (set semantics). Parallel Publish
   records sum then clip within the one bundle, so an edit's record is a
   delta. Rather than ask the author for a delta, the pad opens at where the
   post's own records stand — `Current opinion`, +0.10 here, the compose
   default — and the pick is where they will stand once the edit lands. The
   client signs the difference: the pick less the bundle's raw sum. So the
   readouts are two, `Current opinion` over `Your pick` (`AttachmentStanding`),
   and no landing line follows the field — the pick is the landing. An edit
   nobody adjusts signs 0.00 and moves the attachment by exactly nothing. The
   board draws the pick moved, `RefPairEdit`'s reason: unmoved, the two
   readouts would say one thing twice.

   SET STAGES, IT NEVER SIGNS — the seal-scale pads' grammar (`ComposePad`,
   `ReplyPad`). Set closes the pad onto the edit, the row reading the pick;
   `Sign the edit` signs it with the rest of the batch, inside the edit's own
   record, so the count does not move. Cancel and the scrim stage nothing.

   THE SURFACE BENEATH IS DRAWN WHOLE (`EditComposeBody`), the overlay rule
   from 2026-09-08. */
const CURRENT = 0.1;
const PICK = 0.4;

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
          <HelpDot ariaLabel="Your opinion on your post" />
        </span>

        <AttachmentStanding current={CURRENT} pick={PICK} style={{ paddingRight: 40 }} />

        <div role="group" aria-label="Opinion pad for your own post" style={{ alignSelf: "stretch" }}>
          <AttachmentPad value={PICK} />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="text" size="sm">Cancel</Button>
          <Button size="sm">Set</Button>
        </div>
      </div>
    </>
  );
}

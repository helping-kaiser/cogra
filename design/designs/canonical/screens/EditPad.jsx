/* THE OPINION PAD OVER A POST EDIT (jakob 2026-10-16): what the edit's `Your
   opinion` row's `Adjust` opens. The wash covers the edit; only the parked pad
   is live, which is what the board's `scanExempt` line says.

   IT IS THE ORDINARY FULL PAD, the ruling's own words, at seal scale. Every
   edit's record carries the pair — the uniform grammar — and the edit's pick
   rides that record, so the pad here is the pad everywhere: the field is
   `StancePad`, both axes, and the readouts are the masters' three —
   `Current opinion` (the author's standing fold on the post, the bundle the
   authoring records and their opinions sum to), `Your pick` (what the edit's
   record will carry) and, under the field, `Resulting opinion` (where the pick
   lands the fold: the pad's two-numbers law, unchanged).

   THE PICK OPENS AT THE EDIT'S OWN, which starts at (0, 0): an edit nobody
   adjusts carries a (0, 0) pair, w̃ = 0, and crosses neither channel — the
   author's opinion moves by exactly nothing. The board draws the pick moved,
   `RefPairEdit`'s reason: at the origin the three readouts would say one thing
   three times.

   SET STAGES, IT NEVER SIGNS — the seal-scale pads' grammar (`ComposePad`,
   `ReplyPad`). Set closes the pad onto the edit, the row reading the resulting
   fold; `Sign the edit` signs it with the rest of the batch, inside the edit's
   own record, so the count does not move. Cancel and the scrim stage nothing.

   NO `Walk it back` HERE. An opinion stands on the post, so the ordinary pad
   would carry the walk-away; what walking back inside an edit's batch would
   stage is not ruled (the counter-records are records of their own, and an
   edit's pair rides one), so this board draws the seal-scale pad's two
   controls and the question waits in the backlog.

   THE SURFACE BENEATH IS DRAWN WHOLE (`EditComposeBody`), the overlay rule
   from 2026-09-08. */
const STANDING = {
  current: { pDirected: 0.1, pInterest: 0.1 },
  rawSum: { pDirected: 0.1, pInterest: 0.1 },
  records: 1,
  severed: false,
};
const PICK = { pDirected: 0.3, pInterest: 0.2 };
const RESULTING = { pDirected: 0.4, pInterest: 0.3 };

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

        <StanceStanding pick={PICK} bundle={STANDING} targetLabel="your post" style={{ paddingRight: 40 }} />

        <div role="group" aria-label="Opinion pad for your own post" style={{ alignSelf: "stretch" }}>
          <StancePad value={PICK} />
        </div>

        <StanceLandingLine landing={{ landing: RESULTING, inert: false, severed: false }} />

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="text" size="sm">Cancel</Button>
          <Button size="sm">Set</Button>
        </div>
      </div>
    </>
  );
}

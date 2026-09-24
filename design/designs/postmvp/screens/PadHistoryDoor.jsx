/* THE PAD'S OWN DOOR — the one place the round adds ink to a surface a reader
   uses every day (jakob's rulings 2026-09-22).

   THE FACE IS FULLY SPENT, SO THE DOOR IS THE LINE. A tap on the stance face
   opens this pad and a press-and-hold signs a gentle positive on the spot:
   there is no third gesture left on it, and inventing one would put a history
   behind a gesture a reader discovers by accident. Above the field, though,
   sits "Current opinion" — a readout, and by the door rule a readout is where a
   history hangs.

   THE LINE IS WHERE THE QUESTION IS ASKED. A reader about to move the knob is
   looking straight at the sum their pick will join, and the sum is exactly what
   hides how much is behind it. The tail says what the tap gives them in the
   fewest words that carry it, and the underline is the marker idiom this
   product already uses for a word that opens something.

   A MIS-DRAG CANNOT LAND ON IT. The label is its own target, only as wide as
   its words, and it sits above the pick readout, which sits above the field —
   two rows of separation from the first pixel the knob travels. The pad's own
   rule put the readouts above the field for the same family of reason: a thumb
   covers what it lands on.

   THE SHELL IS THE EVERYDAY FEED, and the pad is parked over it under the wash
   — `PadStanding`'s arrangement exactly, for its stated reason: nineteen boards
   route a face to this pad, so drawing it on one of them would make a
   cross-cutting overlay look like that surface's own. */
export function Screen() {
  return (
    <>
      <PageHeader backHref="#" backLabel="Back to feed" />
      <DetailColumn>
        <PostCard
          {...SALT_MAPS_CURRENT}
          timestamp="12 September"
          score="9.10"
          comments={2}
          bundle={{ current: { pDirected: 1, pInterest: 1 }, rawSum: { pDirected: 27.4, pInterest: 26.1 }, records: 27 }}
          stanceOpen
          stancePadInset={80}
          stanceDefaultPick={{ pDirected: -0.55, pInterest: -0.15 }}
          stanceOnOpenHistory={() => {}}
        />
      </DetailColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />

      {/* The wash sits over the shell; the parked pad (fixed, above it) stays
          sharp — `VouchBackPad`'s arrangement, unchanged. */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--scrim-dialog)" }} />
    </>
  );
}

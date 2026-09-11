/* THE DETAILS STAGE AGAINST ITS CAPS (readme §13, the caps-affordance round) —
   `ComposeDetails` with both of its capped fields where the affordance is
   visible: the title inside the last stretch of its hundred, the description
   past its five hundred.

   ONE BOARD FOR BOTH STATES, because the stage has two capped fields and the
   round has two states to draw; `ComposePickedErrors` made the same choice for
   the same reason, a step drawn with enough in it to show its whole vocabulary
   at once. The title's quiet count and the description's refusal read against
   each other here in a way two boards would never have shown: one field is
   being warned, the other is being refused, and nothing about the stage else
   has changed.

   THE FIXTURES ARE THE LENGTHS THEY CLAIM. The title is 94 scalar values of a
   hundred, which is inside the window of 20, so the count says `6 left`; the
   description is 507 of five hundred and says `7 over`. Both readings are
   computed from the text drawn, not spelled onto the board — a board that
   asserted a count its own fixture contradicted would be the first place the
   implementation copied a lie from.

   NEXT IS DISABLED WHILE A FIELD IS OVER, which is what the title cap already
   does in the product: the step does not advance on words it cannot sign. The
   badge stays on the control, and its edge says it goes nowhere — the seal's
   own disabled Sign carries the same pair.

   THE REFUSAL IS THIS SURFACE'S OWN SENTENCE, not the atom's. Each field words
   its own error (copy-voice, *Field errors*); the count beside it is the only
   part the component writes. */
const TITLE = "Salt maps of the coast road — three weekends of rubbings taken at the lowest tides of the year";

const DESCRIPTION =
  "Rubbings from three weekends at low tide, paper laid straight onto the salt crust and worked with the flat of a wax stick until the ridges came through. The third headland gives the finest lines — the crust there dries in plates rather than grains, and a plate holds an edge the way a leaf does. Nothing here is traced, redrawn or corrected afterwards; what the paper took is what the tide had left that morning, including the places where the wind lifted a corner and the line runs out into nothing at all.";

export function Screen() {
  return (
    <ComposeDetailsBody
      title={TITLE}
      description={DESCRIPTION}
      descriptionError="A description is at most 500 characters."
      nextDisabled
    />
  );
}

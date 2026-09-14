/* THE STAGED CITATIONS, OVER THE SEAL (jakob's ruling 2026-09-14, backlog item
   70): what "3 cited" opens. The screen beneath is inert while the sheet is up,
   which is what the board's `scanExempt` line says.

   IT IS `PickedSheet`'S SHAPE, not `RefsSheet`'s. `RefsSheet` is the reading
   side — a published post's topics and references, each row a way IN to what
   was cited. This is the authoring side: a collection the author staged and is
   still holding, managed in one place. The nearest thing the system already
   has to that is the picked pictures' Show-all sheet, so this takes its
   anatomy — rows, then the word that closes it.

   THE ROWS ARE `StagedReference`, THE COMPOSER'S OWN. The details stage already
   draws a staged citation with the kind's mark, the sub-line, the pair signed
   on the act, the × and the name that opens the pair; a sheet that drew its own
   version would be the second drawing of one fact. Each control names its own
   citation, which is what makes a block of three readable at all.

   IT ADDS NOTHING. No "+ Cite something" here: a post's seal carries no
   add-rows by design, and a door out of it that grew one would hand the seal a
   stage's job. `PickedSheet` manages a pick and never offers another, for the
   same reason. Citations are staged where they are staged.

   THE SEAL BENEATH IS THE SEAL — `ComposeSealBody` at the same three citations
   the sheet lists. What a sheet covers is inert, not shortened, and a count
   drawn beside a list it disagreed with is the defect this round closes. */

export function Screen() {
  return (
    <>
      <ComposeSealBody cited={SEAL_CITATIONS.length} />

      <CitedSheet open items={SEAL_CITATIONS} onClose={() => {}} />
    </>
  );
}

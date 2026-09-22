/* THE STAGED TAGS, OVER THE SEAL (backlog item 95; jakob's ruling, the
   batch-rulings round): what "7 tags" opens. The screen beneath is inert while
   the sheet is up, which is what the board's `scanExempt` line says.

   IT IS `ComposeCitations` WITH TAGS IN IT, AND THAT IS THE WHOLE POINT. The
   seal's two counting rows fold for one reason and promise one thing, so they
   open one kind of door; a tags row that walked BACK to the details stage while
   the references row opened a sheet gave the seal two grammars, which is the
   defect item 95 filed.

   THE PILLS ARE `TopicRemovable`, THE COMPOSER'S OWN. The details stage already
   draws a staged tag with its ×, its pair and the name that opens the pair; a
   sheet that drew its own version would be the second drawing of one fact.
   `TagsSheet` carries the argument in full.

   IT ADDS NOTHING. No "+ Add a tag" here: a post's seal carries no add-rows by
   design, and a door out of it that grew one would hand the seal a stage's job.
   Tags are staged where they are staged.

   THE SEAL BENEATH IS THE SEAL — `ComposeSealBody` at the same seven tags the
   sheet lists. What a sheet covers is inert, not shortened, and a count drawn
   beside a list it disagreed with is the defect this round closes. */

const STAGED = SEAL_TAGS_MANY.map((topic) => ({ topic, onRemove: () => {}, onEdit: () => {} }));

export function Screen() {
  return (
    <>
      <ComposeSealBody tags={SEAL_TAGS_MANY} />

      <TagsSheet open items={STAGED} onClose={() => {}} />
    </>
  );
}

/* THE STAGED TAGS, OVER THE PICKER (round 31; jakob 2026-11-11, Q2 b: "why
   would we have the open in place variant when we already have the bottom
   sheet with all of them in it?"): what `Show all` under the picker's three
   newest opens. The screen beneath is inert while the sheet is up, which is
   what the board's `scanExempt` line says.

   IT IS `ComposeTags` OVER THE PICKER INSTEAD OF THE SEAL, AND THAT IS THE
   WHOLE POINT. One sheet holds every staged tag wherever the reader asks to
   see them all — the seals' count row and the picker's door open the same
   `TagsSheet`, unchanged: the same pills, the same × and the same name that
   opens the tag's pair, and `Done` the word that closes it, back to the
   picker.

   THE PICKER BENEATH IS THE PICKER — `TagPickerBody` at its `seven`, the
   three newest over the results and the door, the seven the sheet lists.
   What a sheet covers is inert, not shortened (`ComposeTags`' reason). */

const STAGED = TAG_PICKER_SEVEN.map((topic) => ({ topic, onRemove: () => {}, onEdit: () => {} }));

export function Screen() {
  return (
    <>
      <TagPickerBody v={TAG_PICKER_AT_SEVEN} />

      <TagsSheet open items={STAGED} onClose={() => {}} />
    </>
  );
}

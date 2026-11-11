/* THE STAGED CITATIONS, OVER THE PICKER (round 31; jakob 2026-11-11, Q2 b):
   what `Show all` under the picker's three newest opens. The screen beneath
   is inert while the sheet is up, which is what the board's `scanExempt`
   line says.

   IT IS `ComposeCitations` OVER THE PICKER INSTEAD OF THE SEAL
   (`TagPickerShowAll`'s reason): the same `CitedSheet`, unchanged — the
   rows, each control naming its own citation, the name that opens the
   citation's pair, and `Done`, back to the picker.

   THE PICKER BENEATH IS THE PICKER — `ReferencePickerBody` at its `seven`,
   the three newest over the results and the door, the seven the sheet
   lists. What a sheet covers is inert, not shortened. */

export function Screen() {
  return (
    <>
      <ReferencePickerBody v={REF_PICKER_AT_SEVEN} />

      <CitedSheet open items={REF_PICKER_SEVEN} onClose={() => {}} />
    </>
  );
}

# ReferencePicker · `spec:design:behavior-reference-picker`

WHEN tap a result row GIVEN the row wears the add mark -> the row's target is staged in the composer's references AND the row wears the added mark AND NEVER the picker closes

WHEN tap a result row GIVEN the row wears the added mark -> NEVER a reference is unstaged AND NEVER the picker closes

WHEN tap Done -> the picker closes to the composer it was opened from AND NEVER a staged reference is unstaged

WHEN press the header back -> the picker closes to the composer it was opened from AND NEVER a staged reference is unstaged

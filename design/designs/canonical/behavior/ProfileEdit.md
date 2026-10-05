# ProfileEdit · `spec:design:behavior-profile-edit`

ALWAYS the profile edit is a wizard stage, its Save pinned in the foot

ALWAYS the profile edit carries no bottom bar

ALWAYS the profile edit's top stays pinned while its fields scroll

ALWAYS the profile edit holds the picture's row, Display name, Bio and Website, and no handle

ALWAYS the line Your handle changes in Settings. stands under the fields

ALWAYS Display name, Bio and Website each read Optional

WHEN tap Change picture -> the picture's crop opens AND its Next brings the picture back to this edit, to be signed with the fields under one seal

WHEN tap Save -> the change's seal opens AND NEVER anything is signed before the seal's own commit

WHEN a field is typed in -> it edits in place

ALWAYS a field shows no count while it has room

ALWAYS Display name shows its remaining count in the quiet colour as N left GIVEN 20 characters or fewer remain of its 50

ALWAYS Bio shows its remaining count in the quiet colour as N left GIVEN 50 characters or fewer remain of its 500

ALWAYS Website shows its remaining count in the quiet colour as N left GIVEN 205 characters or fewer remain of its 2,048

ALWAYS a field past its cap takes the error colour, reads its count as N over and its line as its own refusal

ALWAYS Display name's refusal reads A display name is at most 50 characters. GIVEN it is past its cap

ALWAYS Bio's refusal reads A bio is at most 500 characters. GIVEN it is past its cap

ALWAYS Website's refusal reads A website address is at most 2,048 characters. GIVEN it is past its cap

ALWAYS Save stands visible and disabled, the field's refusal on screen as the reason GIVEN a field is past its cap

ALWAYS a cap counts characters as Unicode scalar values

WHEN tap the back arrow -> the profile comes back

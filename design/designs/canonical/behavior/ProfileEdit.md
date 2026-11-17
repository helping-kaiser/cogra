# ProfileEdit · `spec:design:behavior-profile-edit`

ALWAYS the profile edit is a wizard stage, its Save pinned in the foot

ALWAYS the profile edit carries no bottom bar

ALWAYS the profile edit's top stays pinned while its fields scroll

ALWAYS the profile edit holds the picture's row, Display name, Bio and Website, and no handle

ALWAYS Display name, Bio and Website each read Optional

WHEN tap Change picture -> the picture's crop opens AND its Next brings the picture back to this edit, to be signed with the fields under one seal

ALWAYS Remove picture stands beside Change picture GIVEN a picture stands and no new picture is staged, and never otherwise

ALWAYS the picture's buttons stand side by side on one line beside the picture, never one above the other

ALWAYS the two buttons read Change and Remove, or Change and Undo, GIVEN two stand, their spoken names Change picture, Remove picture and Undo removing the picture

ALWAYS a lone button reads Change picture

WHEN tap Remove picture -> the removal is staged AND the monogram returns on the edit at once AND Undo stands where Remove stood AND NEVER anything is signed before the seal's own commit

WHEN tap Undo -> the removal is unstaged AND the picture returns as it stood AND Remove stands again

WHEN tap Undo GIVEN nothing else is staged -> the edit is at rest again AND the line Nothing to sign yet stands on Save AND Save is inert

ALWAYS a staged removal is signed with the fields under one seal, as the picture's clearing

WHEN a new picture's upload fails GIVEN it came back from the crop -> the line One picture didn't upload. stands under the picture's row with Retry and Remove it AND Save still answers

WHEN press Retry under the picture's row -> the failed upload tries again

WHEN press Remove it under the picture's row -> the new picture leaves the edit AND the picture as it stood before returns AND nothing about the picture is staged

ALWAYS the edit signs only when a change is staged, never by comparing the fields' bytes

ALWAYS Save stays visible and inert GIVEN nothing is staged

ALWAYS the line Nothing to sign yet stands on Save in the quiet voice GIVEN nothing is staged

WHEN press Save GIVEN nothing is staged -> NEVER the seal opens AND NEVER anything is signed

WHEN a field change or the picture stages the first change -> Nothing to sign yet goes AND Save answers

ALWAYS the edit opens with nothing staged

WHEN tap Save GIVEN a change is staged -> the change's seal opens AND NEVER anything is signed before the seal's own commit

WHEN tap Save GIVEN the write rule already refuses the signing -> the line You can't sign right now. stands on Save in the quiet voice with its ? AND Save dims AND NEVER the seal opens AND NEVER Retry appears AND NEVER the line takes the failure voice

WHEN tap the ? beside You can't sign right now. -> the dialog Why signing waits opens, its second paragraph the pad's reading for a surface that keeps no draft, Nothing was signed or spent. Try again in a little while.

ALWAYS the write rule's line on the edit is announced politely, as a status

ALWAYS the write rule's line stands, and Save stays dimmed with it, until the next staged change or the next opening of the edit

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

WHEN the stage opens -> focus lands on the stage's heading AND NEVER the keyboard rises before a field is tapped

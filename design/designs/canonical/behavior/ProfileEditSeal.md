# ProfileEditSeal · `spec:design:behavior-profile-edit-seal`

ALWAYS the seal reads back the change as one acts-card row, Profile, saying what the change holds, counted as 1 profile change

ALWAYS the Profile row reads A new followed by the changed parts in the edit's order, picture, display name, bio and website, joined by commas and a last and, as A new picture, bio and website

ALWAYS the Profile row reads The picture removed GIVEN the picture's removal is the only change

ALWAYS the Profile row ends , the picture removed after the other parts, as A new bio, the picture removed GIVEN the picture's removal is staged with other changes

ALWAYS the seal's head shows the picture the change leaves, the monogram GIVEN the picture is removed

ALWAYS the Profile row's value runs on to a second line, never cut off, GIVEN it is longer than one line

ALWAYS the acts card's total reads 1 thing, signed

ALWAYS the acts card carries no all-or-nothing line

ALWAYS the line Every change to your profile is signed in your name and stays in your public record. stands under the acts card

ALWAYS one seal covers a new picture and the fields together GIVEN the picture was changed through the edit

WHEN the seal opens GIVEN the new picture's upload is still running -> the gate line reads Uploading 0 of 1 — signing waits for the picture. over the foot AND Sign the change stays enabled AND a press waits for the upload, then signs

WHEN the new picture's upload fails while the seal waits on it -> the gate line reads One picture didn't upload. Signing waits for it. followed by Retry AND Sign the change is disabled AND NEVER Remove it stands on the seal

WHEN press Retry on the gate line -> the upload starts again AND the gate line returns to its running reading AND Sign the change is enabled again

WHEN tap the "?" -> the dialog Changing your profile opens

WHEN Sign the change is pressed -> Sign the change refuses a second press until the signing answers AND NEVER Sign the change dims

WHEN the signing has not answered 200ms after the press -> Sign the change reads Signing the change… AND NEVER a spinner appears

WHEN the signing answers within 200ms of the press -> NEVER Sign the change reads Signing the change…

WHEN the back arrow, Back or the X is pressed GIVEN Sign the change was pressed and has not answered -> the seal closes AND the change goes on AND NEVER the change is cancelled

ALWAYS Back reads Close and the X is named Close GIVEN Sign the change was pressed and has not answered

WHEN the signing has not answered 5s after the press -> the subline under the total reads Still signing — the network is slow right now. AND NEVER a progress indicator appears

WHEN the signing is taken -> the profile shows the change AND the snackbar reads Signed — your profile shows it now, still settling.

WHEN the signing does not go through GIVEN no answer reached the seal -> the fault line and Retry take the place of Sign the change AND everything above the foot stays as it was

WHEN the signing is refused by the write rule -> the notice You can't sign right now takes the place of Sign the change, over Each signing is paid for, and there's only so much to go around at a time. Nothing was signed or spent. AND Not now stands under the notice AND NEVER Retry appears AND NEVER the notice takes the error colour AND NEVER the notice promises a kept draft

ALWAYS the write-rule notice carries its own ? beside the header's ?, as every seal's notice does

WHEN tap the write-rule notice's ? -> the dialog Why signing waits opens, its second paragraph the pad's reading for a seal that keeps no draft, Nothing was signed or spent. Try again in a little while.

WHEN tap the write-rule notice's Not now -> the seal comes back as it stood before the press AND nothing is signed or spent

WHEN the signing is refused for any other reason, a bug -> the notice This shouldn't have happened takes the place of Sign the change with Try again, Report a problem and Not now, as SealFaultBug draws it AND nothing is signed or spent

WHEN tap the bug notice's Not now -> the profile edit returns as it was left AND NEVER anything is signed

WHEN Sign the change is pressed GIVEN the signing key is not on this device -> the key-absent notice and Restore the key take the place of Sign the change AND Not now stands under the notice AND nothing is signed AND NEVER the notice takes the error colour AND NEVER Keep the draft, restore later appears

WHEN tap the key-absent notice's Not now -> the seal comes back as it stood before the press AND nothing is kept or signed

WHEN press the header back arrow GIVEN Sign the change was not pressed -> the profile edit comes back, one stage behind

WHEN press Back GIVEN Sign the change was not pressed -> the profile edit comes back, one stage behind

WHEN press the header X GIVEN Sign the change was not pressed -> the flow is left AND nothing is signed

WHEN press Sign the change -> Back reads Close in its place from the press itself AND the header X is named Close AND NEVER Close dims

WHEN press Close, the header back arrow, the header X or the system's Back GIVEN Sign the change was pressed and has not answered -> the seal closes AND the change goes on AND NEVER the act is cancelled

WHEN the change has not answered GIVEN the seal was closed while it signed -> the reader's own profile stands as it was AND the line under its head reads Signing… in the pending marker's quiet register

WHEN the signing does not go through GIVEN the seal was closed while it signed -> the profile's head stands as it was AND the line under it reads That didn't sign. in the failure voice followed by Retry AND NEVER the snackbar carries the failure

WHEN the signing is refused by the write rule or for any other reason, a bug, GIVEN the seal was closed while it signed -> the profile's head stands as it was AND the line under it reads That didn't sign. in the failure voice followed by Retry, as any failure reads AND NEVER the line reads You can't sign right now.

WHEN tap Retry under the profile's head -> the same change is asked to sign again AND the line reads Signing… once 200ms pass without an answer

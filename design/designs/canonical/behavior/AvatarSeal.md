# AvatarSeal · `spec:design:behavior-avatar-seal`

ALWAYS the seal reads back the new picture as one acts-card row, Picture, A new profile picture, counted as 1 picture

ALWAYS the acts card's total reads 1 thing, signed

ALWAYS the acts card carries no all-or-nothing line

ALWAYS the line Every change to your profile is signed in your name and stays in your public record. stands under the acts card

WHEN tap the "?" -> the dialog Changing your picture opens

WHEN Sign the change is pressed -> Sign the change refuses a second press until the signing answers AND NEVER Sign the change dims

WHEN the signing has not answered 200ms after the press -> Sign the change reads Signing the change… AND NEVER a spinner appears

WHEN the signing answers within 200ms of the press -> NEVER Sign the change reads Signing the change…

WHEN the back arrow, Back or the X is pressed GIVEN Sign the change reads Signing the change… -> NEVER the seal is left AND the acts card stays readable

ALWAYS the back arrow, Back and the X keep their resting face GIVEN Sign the change reads Signing the change…

WHEN the signing has not answered 5s after the press -> the subline under the total reads Still signing — the network is slow right now. AND NEVER a progress indicator appears

WHEN the signing is taken -> the new picture shows everywhere the reader appears

WHEN the signing does not go through GIVEN no answer reached the seal -> the fault line and Retry take the place of Sign the change AND everything above the foot stays as it was

WHEN the signing is refused by the write rule -> the notice You can't sign right now takes the place of Sign the change, over Each signing is paid for, and there's only so much to go around at a time. Nothing was signed or spent. AND Not now stands under the notice AND NEVER Retry appears AND NEVER the notice takes the error colour AND NEVER the notice promises a kept draft

WHEN tap the write-rule notice's Not now -> the seal comes back as it stood before the press AND nothing is signed or spent

WHEN Sign the change is pressed GIVEN the signing key is not on this device -> the key-absent notice and Restore the key take the place of Sign the change AND nothing is signed AND NEVER the notice takes the error colour

WHEN press the header back arrow -> the picture's crop comes back, one stage behind

WHEN press Back -> the picture's crop comes back, one stage behind

WHEN press the header X -> the flow is left AND nothing is signed

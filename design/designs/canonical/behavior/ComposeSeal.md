# ComposeSeal · `spec:design:behavior-compose-seal`

WHEN Sign and publish is pressed -> Sign and publish refuses a second press until the signing answers AND NEVER Sign and publish dims

WHEN the signing has not answered 200ms after the press -> Sign and publish reads Signing and publishing… AND NEVER a spinner appears

WHEN the signing answers within 200ms of the press -> NEVER Sign and publish reads Signing and publishing…

WHEN the back arrow, Back or the X is pressed GIVEN Sign and publish reads Signing and publishing… -> NEVER the seal is left AND the fact rows stay readable

WHEN the signing has not answered 5s after the press -> the subline under the total reads Still signing — the network is slow right now. AND NEVER a progress indicator appears

WHEN the app opens again GIVEN it was closed while a signing was in flight -> the signing's outcome shows as the ordinary settled or failure notice

WHEN the signing does not go through GIVEN no answer reached the seal -> the fault line and Retry take the place of Sign and publish AND everything above the foot stays as it was

WHEN the signing is refused for one staged citation GIVEN the cited post never landed -> that citation's row reads This post didn't land, so it can't be cited. followed by Remove it AND Sign and publish stays AND NEVER Retry appears

WHEN Sign and publish is pressed GIVEN the reader is an applicant whose application is live -> the wizard closes onto the applicant's own feed AND the snackbar reads Your post waits with your application — it arrives with you. AND NEVER the detail view opens AND NEVER the snackbar reads Signed — it's in the thread now, still settling.

WHEN Sign and publish is pressed GIVEN the reader is an applicant whose application was closed -> the wizard closes onto the applicant's own feed AND the snackbar reads Your post waits — it arrives when someone vouches you in. AND NEVER the snackbar reads Your post waits with your application — it arrives with you.

WHEN the signing is refused for one staged act GIVEN the act's target landed -> the notice This shouldn't have happened takes the place of Sign and publish AND Try again, Report a problem and Discard the post stand with it AND everything above the foot stays as it was AND NEVER a line in the failure voice appears

WHEN the signing is refused by the write rule -> the notice You can't sign right now takes the place of Sign and publish AND Keep the draft, sign later stands under it AND everything above the foot stays as it was AND NEVER Retry appears AND NEVER the notice takes the error colour

WHEN Sign and publish is pressed GIVEN the signing key is not on this device -> the notice Your key isn't on this browser and Restore the key take the place of Sign and publish AND Keep the draft, restore later stands under it AND nothing is staged or signed AND NEVER the notice takes the error colour

WHEN the signing is taken -> the post's own detail view opens wearing Still settling AND the snackbar reads Signed — it's in the thread now, still settling.

ALWAYS the acts on the seal land together or none of them lands

ALWAYS every act the signature commits is read back in the acts card, one row per kind with its count

ALWAYS the acts card's total reads the number of things signed together

ALWAYS the acts card carries the line They land together, or none does. GIVEN the seal signs more than one act

ALWAYS the acts card carries no all-or-nothing line GIVEN the seal signs one act

ALWAYS the References row reads the one staged citation by its name over its pair GIVEN one citation is staged

ALWAYS the References row reads N cited and a bare count of the citations GIVEN two or more citations are staged

WHEN tap the References row GIVEN two or more citations are staged -> the citations sheet opens over the seal

ALWAYS the Tags row reads the staged tags as chips GIVEN they fit the row

ALWAYS the Tags row reads N tags and a bare count of the tags GIVEN more tags are staged than the row holds

WHEN tap the Tags row GIVEN it reads N tags -> the tags sheet opens over the seal

ALWAYS the License row reads the author's default until the author changes it

ALWAYS the Your opinion row reads one number, never a pair

ALWAYS the Your opinion row reads +0.10 GIVEN the author has not adjusted it

WHEN the sensitive sheet closes on Done GIVEN its switch is on -> the Sensitive row reads Marked with Change

ALWAYS the Sensitive row offers no control that clears the mark

WHEN press the header back arrow -> the details stage comes back, one stage behind

WHEN press Back -> the details stage comes back, one stage behind

WHEN press the header X -> the whole flow is left AND the draft is kept AND NEVER a dialog asks

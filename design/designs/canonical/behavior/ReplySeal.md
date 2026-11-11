# ReplySeal · `spec:design:behavior-reply-seal`

ALWAYS the reply's seal reads back everything the signature commits before it is given

ALWAYS the reply's seal carries + Add a tag and + Cite something as rows of its acts card

ALWAYS the reply's seal's opinion row reads Toward what you answer, and the note under it reads Replying also signs an opinion on what it answers.

ALWAYS the reply's seal quotes a post it answers by its title and its author's handle

WHEN tap Sign comment -> Sign comment refuses a second press until the signing answers AND NEVER Sign comment dims

WHEN the signing has not answered 200ms after the press -> Sign comment reads Signing comment… AND NEVER a spinner appears

WHEN the signing answers within 200ms of the press -> NEVER Sign comment reads Signing comment…

WHEN the signing is taken -> the thread reopens AND the reply settles on its parent wearing Still settling

WHEN the signing does not go through GIVEN no answer reached the seal -> the fault line and Retry take the place of Sign comment AND everything above the foot stays as it was

WHEN the signing is refused for one staged citation GIVEN the cited post never landed -> that citation's row reads This post didn't land, so it can't be cited. followed by Remove it AND Sign comment stays AND NEVER Retry appears

WHEN the signing is refused for one staged act GIVEN the act's target landed -> the notice This shouldn't have happened takes the place of Sign comment AND Try again, Report a problem and Discard the reply stand with it AND everything above the foot stays as it was AND NEVER a line in the failure voice appears

WHEN tap Discard the reply under the notice This shouldn't have happened -> the discard dialog Discard this reply? opens over the seal with Nothing is kept. AND NEVER the reply is discarded unasked

WHEN the write rule refuses the reply -> nothing is staged or spent AND the notice says the reply is still here AND NEVER Retry appears

ALWAYS the References row reads N cited and a bare count of the citations GIVEN two or more citations are staged

WHEN tap the References row GIVEN two or more citations are staged -> the citations sheet opens over the seal

ALWAYS the Tags row reads the staged tags as chips GIVEN they fit the row

ALWAYS the Tags row reads N tags and a bare count of the tags GIVEN more tags are staged than the row holds

WHEN tap the Tags row GIVEN it reads N tags -> the tags sheet opens over the seal

WHEN the key leaves while the reply is written -> Sign comment leads to the reply-scale key notice with restore or discard

WHEN tap the seal's back arrow or Back -> the composer returns one stage back with the words and media as they were

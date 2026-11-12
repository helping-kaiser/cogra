# KeptPicksSeal · `spec:design:behavior-kept-picks-seal`

ALWAYS the kept picks' seal is the standard seal: What you sign in the header, the header's ?, the acts card, and Sign the picks over Back

ALWAYS the acts card reads one row per pick still in the review, each with what it is on and its pair, and a count of 1

ALWAYS a pick on a post or a person reads Opinion, and a pick on a topic reads Feeling, its name the topic's with its # and its pair spoken in the Affinity pad's axis words, How much you like it and How close you want to be

ALWAYS the acts card's total reads the number of picks as things, signed together, GIVEN the seal signs more than one pick

ALWAYS the acts card carries no all-or-nothing line, the seal's "?" How signing works saying it

ALWAYS nothing on the seal is removable

ALWAYS a pick whose target was removed reads back by its removal mark where the name stood, Removed by its author in the system's voice, over the pair it still signs

ALWAYS a pick whose target's read gets no answer reads back by its kind alone where the name stood, A post, A comment or A person, over the pair it still signs

ALWAYS a pick that nets its bundle to nothing reads its pair and nothing more on the seal

ALWAYS a kept vouch-back or approval never stands on this seal

ALWAYS the picks on the seal sign together or none of them signs

WHEN press Sign the picks -> Sign the picks refuses a second press until the signing answers AND NEVER a severance confirmation is asked AND NEVER Sign the picks dims

WHEN the signing has not answered 200ms after the press -> Sign the picks reads Signing the picks… AND NEVER a spinner appears

WHEN the signing has not answered 5s after the press -> the subline under the total reads Still signing — the network is slow right now. AND NEVER a progress indicator appears

WHEN the signing is taken -> the seal leaves for where the review was opened from AND the snackbar reads Signed 4 things, still settling. with the count of the batch AND each target's anchor wears Still settling until its record is ordered AND the settings row that reopened the review goes

WHEN the signing does not go through GIVEN no answer reached the seal -> the fault line and Retry take the commit's place AND nothing is signed AND every pick stays kept

WHEN the write rule refuses the batch -> nothing is staged or spent AND the notice's fact ends Nothing was signed or spent — your picks are still kept. AND its way out reads Not now AND NEVER a pick is dropped

WHEN press Not now on the write rule's notice -> the kept picks' review stands again with every pick still in it

WHEN the signing is refused for one staged act GIVEN the act's target landed -> the notice This shouldn't have happened takes the commit's place AND Try again stands in the notice AND Report a problem and Not now stand under it AND NEVER a pick is dropped

WHEN press Not now on the bug notice -> the kept picks' review stands again with every pick still in it AND NEVER a dialog asks

ALWAYS one quiet line under the acts card reads An approval waits in your invites — go there to sign it. with Open Invites at its end GIVEN an approval was kept with the picks

ALWAYS no line about an approval stands GIVEN no approval was kept

WHEN tap Open Invites -> Invites opens, where the kept approval waits as its own card AND NEVER the approval is signed with the picks AND every pick stays kept

WHEN press the header back arrow GIVEN Sign the picks was not pressed -> the kept picks' review comes back, one stage behind, every pick still in it

WHEN press Back GIVEN Sign the picks was not pressed -> the kept picks' review comes back, one stage behind, every pick still in it

WHEN press the header X, Leave — your picks are kept GIVEN Sign the picks was not pressed -> the flow is left for where the review was opened from AND NEVER anything is signed AND every pick stays kept AND the Key backup group's row reopens the review

WHEN tap the header's ? -> the signing text opens

WHEN press Sign the picks -> Back reads Close in its place from the press itself AND the header X is named Close AND NEVER Close dims

WHEN press Close, the header back arrow, the header X or the system's Back GIVEN Sign the picks was pressed and has not answered -> the seal leaves for where the review was opened from AND the batch goes on as a whole AND each target's row reads Signing… under its face until the batch answers AND NEVER the act is cancelled

WHEN the signing does not go through GIVEN the seal was closed while it signed -> nothing is signed AND every pick stays kept AND the Key backup group's row reads That didn't sign. in the failure voice under its label followed by Retry AND NEVER the snackbar carries the failure

WHEN tap Retry on the Key backup group's row -> the whole batch is asked to sign again AND each target's row reads Signing… under its face until the batch answers

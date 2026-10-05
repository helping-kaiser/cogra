# KeptPicksSeal · `spec:design:behavior-kept-picks-seal`

ALWAYS the kept picks' seal is the standard seal: What you sign and Last step in the header, the header's ?, the acts card, and Sign the opinions over Back

ALWAYS the acts card reads one Opinion row per pick still in the review, each with what it is on and its pair, and a count of 1

ALWAYS the acts card's total reads the number of picks as things, signed together, and its subline reads They land together, or none does. GIVEN the seal signs more than one pick

ALWAYS nothing on the seal is removable

ALWAYS a pick whose target was removed reads back by its removal mark where the name stood, Removed by its author in the system's voice, over the pair it still signs

ALWAYS a pick that nets its bundle to nothing reads its pair and nothing more on the seal

ALWAYS a kept vouch-back or approval never stands on this seal

ALWAYS the picks on the seal sign together or none of them signs

WHEN press Sign the opinions -> Sign the opinions refuses a second press until the signing answers AND NEVER a severance confirmation is asked AND NEVER Sign the opinions dims

WHEN the signing has not answered 200ms after the press -> Sign the opinions reads Signing the opinions… AND the header back arrow, Back and the header X refuse a press AND NEVER they dim AND NEVER a spinner appears

WHEN the signing has not answered 5s after the press -> the subline under the total reads Still signing — the network is slow right now. AND NEVER a progress indicator appears

WHEN the signing is taken -> the seal leaves for where the review was opened from AND the snackbar reads Signed 3 things, still settling. with the count of the batch AND each target's anchor wears Still settling until its record is ordered AND the settings row that reopened the review goes

WHEN the signing does not go through GIVEN no answer reached the seal -> the fault line and Retry take the commit's place AND nothing is signed AND every pick stays kept

WHEN the write rule refuses the batch -> nothing is staged or spent AND the notice's fact ends Nothing was signed or spent — your picks are still kept. AND its way out reads Not now AND NEVER a pick is dropped

WHEN press Not now on the write rule's notice -> the kept picks' review stands again with every pick still in it

WHEN press the header back arrow -> the kept picks' review comes back, one stage behind, every pick still in it

WHEN press Back -> the kept picks' review comes back, one stage behind, every pick still in it

WHEN press the header X, Leave — your picks are kept -> the flow is left for where the review was opened from AND NEVER anything is signed AND every pick stays kept AND the Key backup group's row reopens the review

WHEN tap the header's ? -> the signing text opens

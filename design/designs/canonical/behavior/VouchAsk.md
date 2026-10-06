# VouchAsk · `spec:design:behavior-vouch-ask`

ALWAYS the ask lands with the pad closed

ALWAYS the ask names the person asking and nobody else, and gives no reason

ALWAYS the person asking wears a monogram and never a picture

ALWAYS the ask carries its card and its way back and nothing else, no band, no bar and no feed

WHEN an ask link opens GIVEN a member with a usable link, or a guest -> this page opens with the pad closed AND NEVER anything is staged by the opening

WHEN an ask link opens GIVEN the reader is an applicant -> the reader lands where app-open lands for them AND the snackbar reads You can vouch once you're in. AND NEVER this page opens

WHEN an ask link opens GIVEN the reader is the asker -> the reader lands where app-open lands for them AND the snackbar reads That's your own ask link — send it to someone who's already in. AND NEVER this page opens

WHEN an ask link opens GIVEN a member who already has the asker in their queue -> Invites opens where that row is AND the snackbar reads @noor is already waiting in your invites. AND NEVER this page opens

WHEN tap the stance affordance GIVEN a member -> the pad blooms over the ask at the standing low default AND NEVER at a value the link carried

WHEN tap the stance affordance GIVEN a guest -> the guest gate rises over the ask AND NEVER the pad opens

WHEN a guest signs in from the gate over the ask -> the ask comes back

WHEN a press-and-hold on the stance affordance reaches 500ms GIVEN a member -> the modest positive +0.10 / +0.10 is signed without the pad AND the affordance refuses a second press-and-hold until the signing answers AND NEVER a value the link carried is signed AND NEVER the face moves before the signature is taken

WHEN the hold's signing has not answered 200ms after the hold -> the line under the affordance's face reads Signing… AND NEVER a spinner appears

WHEN the hold's signing is taken -> the vouch lands AND Invites opens with the person now this member's to have vouched in AND the snackbar reads Signed, still settling. Current opinion with the pick's face

WHEN the hold's signing does not go through -> the affordance's face stays where it was AND the line under it reads That didn't sign. followed by Retry AND NEVER the snackbar carries the failure

WHEN the hold's signing is refused by the write rule -> the affordance's face stays where it was AND the line under it reads You can't sign right now. AND NEVER Retry appears AND NEVER the line takes the failure voice

WHEN press and hold the stance affordance GIVEN a guest -> the guest gate rises over the ask, as a tap raises it AND NEVER anything is signed

ALWAYS the header's arrow reads a plain Back, with no origin noun

WHEN tap Not now -> the state the link opened over comes back AND nothing is signed AND the ask still stands

WHEN tap the back arrow -> the state the link opened over comes back AND nothing is signed AND the ask still stands

WHEN tap Not now GIVEN the link opened the app cold -> the feed's root opens AND nothing is signed

WHEN tap the back arrow GIVEN the link opened the app cold -> the feed's root opens AND nothing is signed

WHEN an ask link opens GIVEN the reader is an applicant or the asker and the link cannot stage anyone right now -> the reader's own case answers, at app-open with its snackbar AND NEVER VouchAskUnusable opens

ALWAYS the same ask link opens this page again for every reader it was sent to GIVEN its application can still be staged

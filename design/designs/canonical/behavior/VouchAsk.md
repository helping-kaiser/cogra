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

WHEN tap Not now -> the feed's root opens AND nothing is signed AND the ask still stands

WHEN tap the back arrow -> the feed's root opens AND nothing is signed AND the ask still stands

ALWAYS the same ask link opens this page again for every reader it was sent to GIVEN its application can still be staged

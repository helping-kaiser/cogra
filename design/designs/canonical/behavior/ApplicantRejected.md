# ApplicantRejected · `spec:design:behavior-applicant-rejected`

ALWAYS the closed application's card stands GIVEN the application was closed and no member has taken the reader up since

ALWAYS the closed application's card has no way to put it away

ALWAYS the card is titled by the member who closed the application, @kel closed your application

ALWAYS the ask link stands whole on the card with its label Ask someone you know to vouch for you and its caption Send it to anyone who is already in. It does not expire, and it works however many people you send it to.

ALWAYS the account reads, ranks and browses exactly as before the close

ALWAYS the band names the issuer of the reader's invite link and reads Browsing from @kel's view — your own starts when someone vouches you in.

WHEN the application is closed -> NEVER the feed re-ranks AND NEVER the band changes its account

WHEN the application is closed while the reader is on the shell -> the card flips in place to the closed application's card where the reader stands

WHEN tap Copy your ask link -> the ask link lands on the clipboard AND the snackbar reads Link copied

WHEN Sign and publish is pressed on the seal GIVEN the application is closed -> the wizard closes onto this feed AND the snackbar reads Your post waits — it arrives when someone vouches you in. AND the post waits on the device, never sent AND NEVER the snackbar says the post waits with an application

WHEN tap New post on the bar GIVEN a post already waits -> the snackbar reads Your post waits — it arrives when someone vouches you in. AND NEVER the wizard opens

WHEN tap a stance face GIVEN an opinion already waits -> the snackbar reads Your opinion waits — it arrives when someone vouches you in. AND NEVER the pad opens

WHEN someone vouches the reader in -> the waiting post and opinion arrive with the vouch-in

WHEN tap the closed application's notification -> this shell opens at the card where the ask link stands

WHEN tap Profile on the bar -> the applicant's own profile opens

WHEN the first opinion stages, by Set or by a press-and-hold -> the face takes the staged pick AND the snackbar reads Your opinion waits — it arrives when someone vouches you in.

WHEN a member takes the application up through the ask link -> the card flips to the landing card AND the band's line reads Browsing from @kel's view while your application lands. AND the band still names @kel

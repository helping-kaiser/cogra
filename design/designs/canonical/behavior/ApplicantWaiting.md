# ApplicantWaiting · `spec:design:behavior-applicant-waiting`

ALWAYS the waiting card stands GIVEN every owed step is done and the application waits on its approval, unless it was put away on this device

ALWAYS the waiting card names the member whose approval is in play and never the role inviter

ALWAYS the band reads Browsing from @mira's view while your application lands. naming the issuer of the reader's invite link

ALWAYS the waiting card shows no clock and no figure counting down

ALWAYS the ask link stands whole on the waiting card with its caption It does not expire. While @mira's answer is open, it can't start a second application.

WHEN tap Copy your ask link -> the ask link lands on the clipboard AND the snackbar reads Link copied

WHEN tap Got it -> the waiting card steps aside AND it stays away on this device

WHEN the application is approved -> the landing card stands where the waiting card stood, flipped where the reader stands AND it stands whether or not the waiting card was put away

WHEN the application is closed -> the closed application's card stands where the waiting card stood, flipped where the reader stands AND it stands whether or not the waiting card was put away

WHEN Sign and publish is pressed on the seal GIVEN the reader is an applicant -> the wizard closes onto this feed AND the snackbar reads Your post waits with your application — it arrives with you. AND the post waits in the reader's own chronicle, seen by them alone AND NEVER the snackbar says the post is signed

WHEN tap New post on the bar GIVEN a post is already staged -> the snackbar reads Your post waits with your application — it arrives with you. AND NEVER the wizard opens

WHEN tap a stance face GIVEN an opinion is already staged -> the snackbar reads Your opinion waits with your application — it arrives with you. AND NEVER the pad opens

WHEN press-and-hold a stance face GIVEN no opinion is staged yet -> a positive opinion stages with the application

WHEN tap Profile on the bar -> the applicant's own profile opens

WHEN the first opinion stages, by Set or by a press-and-hold -> the face takes the staged pick AND the snackbar reads Your opinion waits with your application — it arrives with you.

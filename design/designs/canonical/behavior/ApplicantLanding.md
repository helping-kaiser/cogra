# ApplicantLanding · `spec:design:behavior-applicant-landing`

ALWAYS the landing card stands GIVEN the application is approved and its registration has not landed

ALWAYS the landing card is titled Approved — your registration is landing

ALWAYS the landing card reads @mira approved your application. Nothing is needed from you while it lands. and carries no control GIVEN the key is on this device

ALWAYS the landing card reads Your key was made on another device — open CoGra there, or restore the key to land here. and carries Restore the key GIVEN the key is on another device

ALWAYS the landing card has no way to put it away

ALWAYS the band reads Browsing from @mira's view while your application lands. naming the issuer of the reader's invite link

WHEN the app opens GIVEN the application is approved and the key is on this device -> the device signs the registration's handshake AND NEVER the reader is asked to act

WHEN the registration lands -> the landing card flips live to the vouch card where the reader stands AND NEVER the feed reloads AND NEVER a tap is needed

WHEN tap Restore the key GIVEN the key is on another device -> the restore opens

WHEN the restore brings the key here -> the landing card reads its key-here body AND the registration lands from this device

WHEN tap New post on the bar GIVEN a post is already staged -> the snackbar reads Your post waits with your application — it arrives with you. AND NEVER the wizard opens

WHEN tap a stance face GIVEN an opinion is already staged -> the snackbar reads Your opinion waits with your application — it arrives with you. AND NEVER the pad opens

WHEN tap Profile on the bar -> the applicant's own profile opens

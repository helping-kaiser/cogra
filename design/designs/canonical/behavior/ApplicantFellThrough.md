# ApplicantFellThrough · `spec:design:behavior-applicant-fell-through`

WHEN the approval in play falls through before the reader is in GIVEN no other approval is live -> the landing card flips to the fall-through card where the reader stands AND NEVER the feed reloads AND NEVER a tap is needed

ALWAYS the fall-through card is titled The approval didn't land and reads You're waiting again — anyone who's already in can vouch you in, and the first vouch lands it.

ALWAYS the fall-through card names no member

ALWAYS the ask link stands whole on the fall-through card with its label Ask someone you know to vouch for you and its caption Send it to anyone who is already in. It does not expire, and it works however many people you send it to.

ALWAYS the fall-through card stands whether or not the waiting card was put away on this device

ALWAYS the band reads Browsing from @mira's view while your application lands. naming the issuer of the reader's invite link

ALWAYS the fall-through card shows no clock and no figure counting down

WHEN tap Got it -> the fall-through card steps aside AND it stays away on this device

WHEN tap Copy your ask link -> the ask link lands on the clipboard AND the snackbar reads Link copied

WHEN a member vouches the reader in again -> the landing card stands where the fall-through card stood, flipped where the reader stands AND it stands whether or not the fall-through card was put away

WHEN tap Profile on the bar -> the applicant's own profile opens

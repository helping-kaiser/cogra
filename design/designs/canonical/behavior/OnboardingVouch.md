# OnboardingVouch · `spec:design:behavior-onboarding-vouch`

ALWAYS the card carries no bottom bar

ALWAYS Skip and Start reading are the card's only live controls

ALWAYS the dots are an indicator and never a control, spoken Step 5 of 5

ALWAYS the inviter's face is the actual link-issuer's avatar, and their monogram where they have no photo, whoever re-watches the card

ALWAYS the card's words say invited and never vouched

ALWAYS the applicant's line The friend who sent you this invite has to let you in. Ask them once you have verified your email. stands under the card's words GIVEN the reader is an applicant whose application is live

ALWAYS no applicant's line stands GIVEN the reader is a member, or an applicant whose application was closed

WHEN tap Start reading GIVEN the reader is an applicant -> the intro leaves for the applicant's feed it opened over, where Skip leaves

WHEN tap Start reading GIVEN the reader is a member -> the intro leaves for the feed it opened over, where Skip leaves

WHEN tap Skip GIVEN the reader is an applicant -> the intro leaves for the applicant's feed it opened over

WHEN tap Skip GIVEN the reader is a member -> the intro leaves for the feed it opened over

ALWAYS the cards move only by their buttons, and a swipe moves nothing

WHEN press Android Back -> the fourth card opens

WHEN tap Skip GIVEN Settings re-opened the intro -> Settings comes back AND NEVER a later card shows

WHEN tap Start reading GIVEN Settings re-opened the intro -> Settings comes back

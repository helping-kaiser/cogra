# OnboardingPublic · `spec:design:behavior-onboarding-public`

ALWAYS the card carries no bottom bar

ALWAYS Skip and Next are the card's only live controls

ALWAYS the drawn chat and comment take no input

ALWAYS the dots are an indicator and never a control, spoken Step 3 of 5

WHEN tap Next -> the fourth card opens

WHEN tap Skip GIVEN the reader is an applicant -> the intro leaves for the applicant's feed it opened over AND NEVER a later card shows

WHEN tap Skip GIVEN the reader is a member -> the intro leaves for the feed it opened over AND NEVER a later card shows

ALWAYS the cards move only by their buttons, and a swipe moves nothing

WHEN press Android Back -> the second card opens

WHEN tap Skip GIVEN Settings re-opened the intro -> Settings comes back AND NEVER a later card shows

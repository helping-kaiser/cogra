# OnboardingSteps · `spec:design:behavior-onboarding-steps`

WHEN the reader first enters an authenticated feed, from applicant on, GIVEN the account's seen flag is unset -> the intro opens full-screen over that feed at this card

WHEN the feed is entered GIVEN the account's seen flag is set, on any device -> NEVER the intro opens by itself

WHEN tap Watch the intro again in Settings -> the intro opens at this card

ALWAYS the card carries no bottom bar

ALWAYS Skip and Next are the card's only live controls

ALWAYS the dots are an indicator and never a control, spoken Step 1 of 5

ALWAYS the card's drawing carries no numbers

WHEN tap Next -> the second card opens

WHEN tap Skip GIVEN the reader is an applicant -> the intro leaves for the applicant's feed it opened over AND NEVER a later card shows

WHEN tap Skip GIVEN the reader is a member -> the intro leaves for the feed it opened over AND NEVER a later card shows

ALWAYS the cards move only by their buttons, and a swipe moves nothing

WHEN press Android Back -> the intro leaves the way Skip leaves

WHEN tap Skip GIVEN Settings re-opened the intro -> Settings comes back AND NEVER a later card shows

WHEN the intro shows for the first time -> the account's seen flag is set at once AND NEVER the flag waits for Skip or Start reading

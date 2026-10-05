# OnboardingShape · `spec:design:behavior-onboarding-shape`

ALWAYS the card carries no bottom bar

ALWAYS Skip and Next are the card's only live controls

ALWAYS the drawn pad takes no input

ALWAYS each face on an edge is spoken by its anchor's own words

ALWAYS the dots are an indicator and never a control, spoken Step 2 of 5

WHEN tap Next -> the third card opens

WHEN tap Skip GIVEN the reader is an applicant -> the intro leaves for the applicant's feed it opened over AND NEVER a later card shows

WHEN tap Skip GIVEN the reader is a member -> the intro leaves for the feed it opened over AND NEVER a later card shows

ALWAYS the cards move only by their buttons, and a swipe moves nothing

WHEN press Android Back -> the first card opens

WHEN tap Skip GIVEN Settings re-opened the intro -> Settings comes back AND NEVER a later card shows

ALWAYS the illustration scales to the column, and the card scrolls between Skip and its button when its words outgrow the screen at any width or text size

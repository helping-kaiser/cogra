# OnboardingPublic · `spec:design:behavior-onboarding-public`

ALWAYS the card carries no bottom bar

ALWAYS Skip and Next are the card's only live controls

ALWAYS the drawn chat and comment take no input

ALWAYS the dots are an indicator and never a control, spoken Step 3 of 5

WHEN tap Next -> the fourth card opens

WHEN tap Skip GIVEN the reader is an applicant -> the intro leaves for the applicant's feed it opened over AND NEVER a later card shows

WHEN tap Skip GIVEN the reader is a member -> the intro leaves for the feed it opened over AND NEVER a later card shows

ALWAYS the illustration scales to the column, and the card scrolls between Skip and its button when its words outgrow the screen at any width or text size

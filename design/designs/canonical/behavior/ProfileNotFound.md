# ProfileNotFound · `spec:design:behavior-profile-not-found`

ALWAYS the page reads This profile doesn't exist. GIVEN the profile link's handle resolves to nothing

ALWAYS the header bar keeps the handle that was asked for as its title

ALWAYS the page offers no Retry and no other way on but the back arrow

ALWAYS the page carries no ⋮

ALWAYS the page never takes the error colour

ALWAYS the bottom bar rides with no slot lit

WHEN tap the back arrow -> the reader returns to where they came from, in the state they left it AND the arrow's label names that origin

ALWAYS the back arrow reads Back to feed and leads to the feed GIVEN the page was entered with no history behind it

WHEN tap the Profile slot -> the reader's own profile opens

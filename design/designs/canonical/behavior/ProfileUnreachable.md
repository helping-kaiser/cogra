# ProfileUnreachable · `spec:design:behavior-profile-unreachable`

ALWAYS the page reads Can't reach the server — this profile can't load right now. in the failure voice, with an outlined Retry under it GIVEN the profile's read reached no server

ALWAYS the header bar keeps the profile's handle as its title, and the page's own chrome stands

ALWAYS the bottom bar keeps lit the slot of the root the profile was opened from, Feed from the feed

WHEN tap Retry GIVEN the read now reaches the server -> the profile opens in the fault's place

WHEN tap Retry GIVEN the read still reaches no server -> the fault stands in place

WHEN tap the back arrow -> the reader returns to where they came from, in the state they left it AND the arrow's label names that origin

ALWAYS the back arrow reads Back to feed and leads to the feed GIVEN the page was entered with no history behind it

WHEN tap the Profile slot -> the reader's own profile opens

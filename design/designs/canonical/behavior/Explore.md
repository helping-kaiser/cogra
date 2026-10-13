# Explore · `spec:design:behavior-explore`

ALWAYS Explore at rest reads explore.searchField, then explore.skyCard, then Your topics, then Recent

ALWAYS explore.skyCard reads The Sky — coming soon and opens nothing

WHEN the reader types in explore.searchField -> explore.skyCard drops off the bottom edge AND the searching view takes the screen

ALWAYS searching is a state of Explore's root and never a screen of its own

ALWAYS explore.searchField carries a trailing × GIVEN it holds text

WHEN tap the trailing × -> explore.searchField empties AND Explore stands at rest

WHEN press system Back GIVEN the searching view stands -> explore.searchField empties AND Explore stands at rest AND NEVER Explore is left

WHEN the reader empties explore.searchField -> Explore stands at rest

WHEN the reader comes back from an opened result -> the query and the results' scroll stand as they were left

ALWAYS the recent searches are kept on the device and never as a record

WHEN a result is opened GIVEN explore.searchField holds a query -> the query joins the recent searches

WHEN press the keyboard's action key GIVEN explore.searchField holds a query -> the keyboard dismisses AND the query joins the recent searches AND NEVER anything else happens

ALWAYS the recent searches keep the ten newest, newest first, and a query met again in any case moves to the top and never stands twice

ALWAYS explore.recent carries no × of its own

ALWAYS the recent searches are kept per account on the device and cleared at sign-out, and a guest's are kept on the device alone

WHEN tap a recent search -> its query runs again

ALWAYS explore.band stands bare, with no explore.band.bell, GIVEN the reader is a guest

ALWAYS no explore.topics stands GIVEN the reader is a guest

ALWAYS an applicant's Explore reads as a member's

ALWAYS Your topics' second line counts the topics the reader holds, the length of the list it opens

WHEN tap the bar's Explore slot GIVEN Explore is at its top -> NEVER Explore refreshes

WHEN pull down GIVEN Explore stands at rest -> NEVER Explore refreshes AND NEVER a refresh indicator shows

# Explore · `spec:design:behavior-explore`

ALWAYS Explore at rest reads explore.searchField, then explore.skyCard, then Your topics, then Recent

ALWAYS explore.skyCard reads The Sky — coming soon and opens nothing

WHEN the reader types in explore.searchField -> explore.skyCard drops off the bottom edge AND the searching view takes the screen

ALWAYS the recent searches are kept on the device and never as a record

WHEN tap a recent search -> its query runs again

ALWAYS Your topics' second line counts the topics the reader holds, the length of the list it opens

WHEN tap the bar's Explore slot GIVEN Explore is at its top -> NEVER Explore refreshes

WHEN pull down GIVEN Explore stands at rest -> NEVER Explore refreshes AND NEVER a refresh indicator shows

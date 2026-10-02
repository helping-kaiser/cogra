# ExploreFilter · `spec:design:behavior-explore-filter`

ALWAYS the search filter's kinds are the feed filter's own list: Posts, Comments, Profiles and Tags

ALWAYS the search filter's kind chips combine

ALWAYS no kind chip is on and the search reads every kind GIVEN the search filter is at its default

ALWAYS the search filter's order section is the feed filter's own: Ranked or Newest, with Show what you've already seen under it

ALWAYS the search filter's order and Show what you've already seen stand at the reader's default GIVEN the search filter is at its default

ALWAYS the reader's default is the one feed filter default, set in Settings, the app's until they set their own

ALWAYS Ranked is the order and Show what you've already seen stands off GIVEN the search filter is at its default and the reader has set no default of their own in Settings

ALWAYS the search filter trigger speaks only the deviations from the search filter's default, a deviation back toward the app's default included

ALWAYS the search filter's foot holds Reset in its corner and Done at its end

ALWAYS the search filter's foot carries no reading of the staged filter

WHEN tap Reset -> the sheet stages the search filter's default AND NEVER the search re-queries

ALWAYS a result counts as seen once its impression entered the viewport, kept on the device and never as a record

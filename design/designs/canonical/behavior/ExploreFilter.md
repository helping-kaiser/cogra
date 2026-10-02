# ExploreFilter · `spec:design:behavior-explore-filter`

ALWAYS the search filter's kinds are the feed filter's own list: Posts, Comments, Profiles and Tags

ALWAYS the search filter's kind chips combine

ALWAYS no kind chip is on and the search reads every kind GIVEN the search filter is at its default

ALWAYS the search filter's order section is the feed filter's own: Ranked or Newest, with Show what you've already seen under it

ALWAYS Show what you've already seen stands off GIVEN the search filter is at its default

ALWAYS the search filter's foot holds Reset in its corner and Done at its end

ALWAYS the search filter's foot carries no reading of the staged filter

WHEN tap Reset -> the sheet stages the search filter's default AND NEVER the search re-queries

ALWAYS a result counts as seen once its impression entered the viewport, kept on the device and never as a record

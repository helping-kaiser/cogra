# ExploreFilter · `spec:design:behavior-explore-filter`

ALWAYS the search filter's kinds are the feed filter's own list: Posts, Comments, Profiles and Tags

ALWAYS the search filter's kind chips combine

ALWAYS no kind chip is on and the search reads every kind GIVEN the search filter is at its default

ALWAYS the search filter's order section is the feed filter's own: Ranked or Newest, with Show what you've already seen under it

ALWAYS the search filter's order and Show what you've already seen stand at the reader's default GIVEN the search filter is at its default

ALWAYS the reader's default is the one feed filter default, set in Settings, the app's until they set their own

ALWAYS Ranked is the order and Show what you've already seen stands off GIVEN the search filter is at its default and the reader has set no default of their own in Settings

ALWAYS explore.filterTrigger speaks only the deviations from the search filter's default, a deviation back toward the app's default included

ALWAYS explore.filterTrigger's spoken name is its reading followed by what the search shows

ALWAYS the search filter's foot holds Reset in its corner and Done at its end

ALWAYS the search filter's foot carries no reading of the staged filter

WHEN tap a kind chip -> the chip's change is staged AND NEVER the results behind the sheet move before Done

WHEN tap Ranked or Newest -> that order is staged AND NEVER the results behind the sheet move before Done

WHEN tap Show what you've already seen -> the toggle flips, staged AND NEVER the results behind the sheet move before Done

WHEN tap Reset -> the sheet stages the search filter's default AND NEVER the search re-queries

WHEN tap Done -> the sheet closes AND the search re-queries once with the staged filter

WHEN tap the scrim -> the sheet closes AND the staged filter is dropped AND the results are what they were AND NEVER anything staged applies

WHEN swipe the sheet down, press system Back or press Escape -> the sheet closes AND the staged filter is dropped AND the results are what they were AND NEVER anything staged applies

ALWAYS a result counts as seen only once it is opened, never by standing in the viewport, and the opened thing then counts by History's own rules and never becomes a graph record

ALWAYS the search filter carries no Show what you've already seen GIVEN the reader is a guest

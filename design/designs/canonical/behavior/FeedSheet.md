# FeedSheet · `spec:design:behavior-feed-sheet`

WHEN the filter sheet opens -> it stands at 88% of the screen's height

ALWAYS the filter's kinds are the kinds V1.0 serves: Posts, Comments, Profiles and Tags

ALWAYS the kind chips combine

ALWAYS the form chips combine

ALWAYS the order is Ranked or Newest, never both

ALWAYS the filter's topic chips are the topics the reader holds an opinion for

ALWAYS at most one topic chip is on

WHEN tap a topic chip GIVEN it is off -> it turns on AND every other topic chip turns off

WHEN tap a topic chip GIVEN it is on -> it turns off AND NEVER another topic chip turns on

ALWAYS Posts is the one kind on, Ranked is the order, Show what you've already seen is off, Still settling is on and Sensitive and Removed are off GIVEN the filter is at its default and the reader has set no default of their own in Settings

ALWAYS the feed admits content not yet landed, wearing Still settling GIVEN the feed's filter has Still settling on

ALWAYS the feed admits only what has landed GIVEN the feed's filter has Still settling off

WHEN the last kind chip is switched off -> NEVER the chip refuses the tap

WHEN pull down inside the filter sheet -> NEVER the feed refreshes

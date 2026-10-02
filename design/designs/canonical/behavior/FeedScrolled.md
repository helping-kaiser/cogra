# FeedScrolled · `spec:design:behavior-feed-scrolled`

WHEN the reader scrolls back up far enough to summon the collapsing band GIVEN the feed is 3 viewport-heights deep or more -> the Back to top pill rides in with the band, centred under it

WHEN the reader scrolls back up far enough to summon the collapsing band GIVEN the feed is shallower than 3 viewport-heights -> NEVER the Back to top pill appears

WHEN the collapsing band leaves GIVEN the Back to top pill stands -> the pill leaves under the band AND NEVER the pill passes over the band

ALWAYS the Back to top pill takes no layout space and leaves the band's collapse point where it is

WHEN tap Back to top -> the list goes to the top, animated AND NEVER the feed refreshes

WHEN tap the bar's Feed slot GIVEN the feed's root is scrolled -> the list goes to the top, animated AND NEVER the feed refreshes

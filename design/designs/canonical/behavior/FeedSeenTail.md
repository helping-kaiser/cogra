# FeedSeenTail · `spec:design:behavior-feed-seen-tail`

ALWAYS feed.seenSeparator stands under the last unseen row GIVEN Show what you've already seen is off and the filter admits rows the reader has already seen

ALWAYS no feed.seenSeparator stands GIVEN the filter admits no row the reader has already seen

ALWAYS feed.seenSeparator.label reads Already seen

ALWAYS feed.seenSeparator is a hairline with feed.seenSeparator.label centred on it, and carries no control

ALWAYS the rows under feed.seenSeparator are the rows the reader has already seen, and the rows above it the rows the reader has not, as they stood when the feed last loaded, refreshed or re-derived

ALWAYS the rows under feed.seenSeparator stand in the order the filter sets, ranked under Ranked and by time under Newest, as the rows above it do

ALWAYS the filter cuts the rows under feed.seenSeparator exactly as it cuts the rows above it, Show what you've already seen alone excepted — the kinds, the kinds of post, the topic, the people row and its sign, Still settling, Sensitive and Removed

ALWAYS a hidden person's rows stay out under feed.seenSeparator as they stay out above it

WHEN the reader scrolls past the last unseen row GIVEN feed.seenSeparator stands -> feed.seenSeparator comes into view AND the seen rows continue under it AND NEVER the feed ends at the last unseen row

WHEN the reader scrolls or reads the rows under feed.seenSeparator -> NEVER anything is recorded

WHEN the feed loads GIVEN Show what you've already seen is off, nothing the filter admits is unseen and the filter admits rows the reader has already seen -> the feed opens at feed.seenSeparator, the seen rows under it AND NEVER an empty state stands

WHEN a row above feed.seenSeparator becomes seen -> NEVER the row moves AND NEVER feed.seenSeparator moves

WHEN the feed refreshes, by a pull down all the way at its top or a tap of feed.bottomBar.feedSlot at its top -> what arrives unseen stands above feed.seenSeparator AND NEVER an unseen row stands under feed.seenSeparator

ALWAYS the feed stands as one list, the seen rows ranked in among the rest and no feed.seenSeparator standing GIVEN Show what you've already seen is on

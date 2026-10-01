# FeedHidden · `spec:design:behavior-feed-hidden`

WHEN tap Hide on a person in the reader's post menu opened from a feed card -> the sheet closes AND that person's rows leave the feed AND the rows behind them move up AND the snackbar reads @ada is hidden — their posts stay out of your feed. with Undo AND NEVER a confirm step appears

ALWAYS nothing marks the space a hidden person's rows left in the feed

ALWAYS a hidden person's profile still opens and their comments still stand under other people's posts

WHEN the reader hides a person from a post detail or their profile -> the reader stays where they were AND the feed next opened holds none of that person's rows

WHEN tap Undo on the hide's snackbar -> the person is unhidden AND their posts come back AND the feed stands as it was before the hide

WHEN tap Undo on the hide's snackbar GIVEN the unhide does not go through -> the feed reverts to the person hidden AND the target's row says so with Retry

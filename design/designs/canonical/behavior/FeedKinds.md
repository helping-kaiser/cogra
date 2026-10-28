# FeedKinds · `spec:design:behavior-feed-kinds`

ALWAYS every feed card's row reads the opinion, then the score, then the kind's own act, then the share GIVEN the card is a post's, a comment's or a tag's

ALWAYS a person's feed card's row reads the opinion, then the score, then the share, its act's slot waiting for chats

ALWAYS a feed card's score is the figure the latest fetch of its thing found — the reader's own last feed fetch, or its trace's fetch since — whatever kind the card is

ALWAYS nothing re-reads one card's standing in the background — the score's tap, which opens the trace and fetches its paths, is the only fetch of one thing's standing

WHEN the trace's fetch finds other than the card's score -> the card's score reads what it found, a dash still opening the trace where it found no paths AND NEVER the figure it wore before AND NEVER the feed re-orders

WHEN the feed is fetched again GIVEN a card's score reads what its trace's fetch found -> the card's score reads what that fetch computed

ALWAYS a feed card's score slot stands bare only for a thing still settling and reads zero only for a severed one, the dash standing for every other figure not computed

ALWAYS a reply is a comment targeting a comment: as standalone content a reply card may appear in any feed, and the under-card reply expansion never appears in a feed

ALWAYS feed.commentCard carries no view-replies line

WHEN feed.commentCard is tapped outside its head row and its own controls -> the post's comment section opens scrolled to that comment

WHEN feed.commentCard.actionRow.reply is tapped -> the post's comment section opens scrolled to that comment AND the reply composer opens aimed at that comment

WHEN feed.tagCard.actionRow.compose, Tag a new post with it, is tapped -> the post composer opens at its first stage AND the tag rides staged among the new post's tags

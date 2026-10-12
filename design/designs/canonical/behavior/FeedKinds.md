# FeedKinds · `spec:design:behavior-feed-kinds`

ALWAYS every feed card's row reads the opinion, then the score, then the kind's own act, then the share GIVEN the card is a post's, a comment's or a tag's

ALWAYS a person's feed card's row reads the opinion, then the score, then the share, its act's slot waiting for chats

ALWAYS a feed card's score is the figure the reader's own last feed fetch computed, whatever kind the card is

ALWAYS nothing re-reads one card's standing in the background — the score's tap, which opens the trace and fetches its paths, is the only fetch of one thing's standing

ALWAYS a feed card's score reads a dash, never the figure it wore before, and still opens the trace GIVEN the trace's fetch found no paths for its thing since the reader's last feed fetch

WHEN the feed is fetched again GIVEN a card's score reads a dash -> the card's score reads what that fetch computed

ALWAYS a feed card's score slot stands bare only for a thing still settling and reads zero only for a severed one, the dash standing for every other figure not computed

ALWAYS a reply is a comment targeting a comment: as standalone content a reply card may appear in any feed, and the under-card reply expansion never appears in a feed

ALWAYS a comment card carries no view-replies line

WHEN the comment card is tapped outside its head row and its own controls -> the post's comment section opens scrolled to that comment

WHEN the comment glyph on a comment card is tapped -> the post's comment section opens scrolled to that comment AND the reply composer opens aimed at that comment

WHEN Tag a new post with it on a tag card is tapped -> the post composer opens at its first stage AND the tag rides staged among the new post's tags

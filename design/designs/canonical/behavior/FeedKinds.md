# FeedKinds · `spec:design:behavior-feed-kinds`

ALWAYS every feed card's row reads the opinion, then the score, then the kind's own act, then the share GIVEN the card is a post's, a comment's or a tag's

ALWAYS a person's feed card's row reads the opinion, then the score, then the share, its act's slot waiting for chats

ALWAYS a comment's replies appear only in its thread, never in the feed

ALWAYS a comment card carries no view-replies line

WHEN the comment card is tapped outside its head row and its own controls -> the post's comment section opens scrolled to that comment

WHEN the comment glyph on a comment card is tapped -> the post's comment section opens scrolled to that comment AND the reply composer opens aimed at that comment

WHEN Tag a new post with it on a tag card is tapped -> the post composer opens at its first stage AND the tag rides staged among the new post's tags

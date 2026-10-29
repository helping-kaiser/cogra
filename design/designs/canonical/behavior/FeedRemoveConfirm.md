# FeedRemoveConfirm · `spec:design:behavior-feed-remove-confirm`

ALWAYS feed.dialog is the post detail's removal dialog on the feed, feed.dialog.title reading Remove this post?

ALWAYS feed.dialog.keep is the filled answer and feed.dialog.remove the quiet one, in no error colour

WHEN press feed.dialog.remove -> feed.dialog stays up on Remove until the removal answers AND feed.dialog.remove refuses a second press AND NEVER feed.dialog.remove dims

WHEN the removal has not answered 200ms after the press -> feed.dialog.remove reads Removing… AND NEVER a spinner appears

WHEN the removal is taken -> feed.dialog closes AND the card stands in its place in the feed as its mark, Removed by its author AND NEVER the card leaves the feed without a mark

WHEN the removal does not go through -> feed.dialog stays up with its pair AND the line That didn't send. Try again. stands above it AND feed.dialog.remove reads Retry AND the post is not removed

WHEN press feed.dialog.keep -> feed.dialog closes AND nothing is removed

WHEN tap the scrim -> feed.dialog closes AND nothing is removed

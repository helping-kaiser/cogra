# FeedRemoveConfirm · `spec:design:behavior-feed-remove-confirm`

ALWAYS feed.dialog is the post detail's removal dialog on the feed, feed.dialog.title reading Remove this post?

ALWAYS feed.dialog.keep is the filled answer and feed.dialog.remove the quiet one, in no error colour

WHEN press feed.dialog.remove -> feed.dialog stays up on Remove until the removal answers AND feed.dialog.remove refuses a second press AND NEVER feed.dialog.remove dims

WHEN the removal has not answered 200ms after the press -> feed.dialog.remove reads Removing… AND NEVER a spinner appears

WHEN the removal is taken -> feed.dialog closes AND the card stands in its place in the feed as its mark, Removed by its author AND NEVER the card leaves the feed without a mark

WHEN the removal does not go through -> feed.dialog stays up with its pair AND feed.dialog.line reads That didn't send. Try again. AND feed.dialog.remove reads Retry AND the post is not removed

WHEN press feed.dialog.keep GIVEN feed.dialog.remove was not pressed -> feed.dialog closes AND nothing is removed

WHEN tap the scrim GIVEN feed.dialog.remove was not pressed -> feed.dialog closes AND nothing is removed

WHEN press feed.dialog.remove -> feed.dialog.keep reads Close in its place from the press itself, filled and live AND NEVER Close dims

WHEN tap Close, tap the scrim, press the system's Back or press Escape GIVEN feed.dialog.remove was pressed and has not answered -> feed.dialog closes AND the removal goes on AND the card's own row in the feed, under its words reads Removing… in the pending marker's quiet register until it answers AND NEVER the removal is cancelled

WHEN the removal is taken GIVEN feed.dialog was closed while it answered -> the line goes AND the card stands in its place as its mark, Removed by its author

WHEN the removal does not go through GIVEN feed.dialog was closed while it answered -> the card's own row in the feed, under its words stands as it was AND says That didn't sign. in the failure voice followed by Retry, which asks the same act again, AND NEVER the snackbar carries the failure

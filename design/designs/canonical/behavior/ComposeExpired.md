# ComposeExpired · `spec:design:behavior-compose-expired`

WHEN a staged post expires unlanded -> the notice Your post didn't land arrives as a card in the feed AND the post has left every reader's view AND nothing was spent AND the draft is kept

WHEN press Open the draft -> compose opens with the draft card leading

WHEN press Dismiss -> the notice leaves the feed

WHEN a staged act that is not a post expires unlanded -> the notice arrives as a card in the feed titled for its family, Your opinion didn't land, Your comment didn't land, Your edit didn't land, Your tag didn't land or Your citation didn't land AND its body names what the act was about, then reads couldn't finish settling. Nothing was spent. AND the act has left every reader's view

ALWAYS the notice for a staged act that is not a post carries Dismiss alone, never Open the draft

# PostDetailVideoSensitive · `spec:design:behavior-post-detail-video-sensitive`

WHEN a clip post's detail opens GIVEN the post is sensitive and unrevealed -> the pinned clip veils in its own place above the card AND the card's body veils AND NEVER the clip plays

ALWAYS the pinned clip stays pinned above the card while veiled, never moved into the card

ALWAYS the pinned clip carries no transport while veiled, its veil face its only control

ALWAYS the title and the tags stay readable while the body is veiled

WHEN tap the pinned clip's veil face -> the pinned clip and the card unveil together AND the clip and the transport come back in place

WHEN tap Show on the card's veil -> the pinned clip and the card unveil together AND the clip and the transport come back in place

ALWAYS a reveal holds for every move inside the app until the app is fully closed or the media is hard reset

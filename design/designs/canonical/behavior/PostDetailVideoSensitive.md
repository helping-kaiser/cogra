# PostDetailVideoSensitive · `spec:design:behavior-post-detail-video-sensitive`

WHEN a clip post's detail opens GIVEN the post is sensitive and unrevealed -> the clip veils in its own place above the card AND the card's body veils AND NEVER the clip plays

ALWAYS the veiled clip stands above the card and scrolls with the page, never moved into the card

ALWAYS the clip carries no transport while veiled, its veil face its only control

ALWAYS the title and the tags stay readable while the body is veiled

WHEN tap the clip's veil face -> the clip and the card unveil together AND the clip and the transport come back in place

WHEN tap Show on the card's veil -> the clip and the card unveil together AND the clip and the transport come back in place

WHEN the clip unveils GIVEN the device allows autoplay -> the clip plays

WHEN the clip unveils GIVEN the device suppresses autoplay -> NEVER the clip starts on its own

ALWAYS a reveal holds for every move inside the app until the app is fully closed or the media is hard reset

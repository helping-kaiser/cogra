# FeedPostLicense · `spec:design:behavior-feed-post-license`

WHEN tap feed.menuSheet.license -> the menu closes AND feed.licenseSheet rises over the feed AND the feed stands unchanged beneath its wash

ALWAYS feed.licenseSheet.terms reads the post's terms exactly as PostLicense reads them over the post

ALWAYS a post's terms read the same from the feed's menu, the reader's menu and the author's own

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> feed.licenseSheet closes AND the feed stands as it was

ALWAYS the license terms are never a state of the card

ALWAYS feed.licenseSheet.terms.publicDomain carries the zero pair's name on the caption line and the rows still spell what it means GIVEN both of the post's license axes are zero

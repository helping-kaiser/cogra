# FeedCover · `spec:design:behavior-feed-cover`

ALWAYS feed.card.media.frame wears its clip's stored still until playback first starts

WHEN feed.card.media.frame's clip first starts playing -> the stored still gives way to playback AND NEVER the stored still returns

WHEN feed.card.media.frame's clip stops being the playing clip -> it freezes on the frame it reached AND NEVER the stored still returns

ALWAYS feed.card.media.frame carries feed.card.media.frame.soundDisc and no other control GIVEN the device allows autoplay

ALWAYS feed.card.media.frame carries feed.card.media.frame.playDisc in the place of feed.card.media.frame.soundDisc GIVEN the device suppresses autoplay

ALWAYS the device suppresses autoplay GIVEN it asks for reduced motion or data saver

ALWAYS no clip on the feed starts on its own GIVEN the device suppresses autoplay

WHEN tap feed.card.media.frame.playDisc -> feed.card.media.frame's clip plays where it stands in the feed AND NEVER the post opens

WHEN tap feed.card.media.frame.soundDisc GIVEN sound is off -> sound turns on for every clip on every surface

WHEN tap feed.card.media.frame.soundDisc GIVEN sound is on -> sound turns off for every clip on every surface

ALWAYS a clip starts muted GIVEN the reader has not turned sound on

# FeedCover · `spec:design:behavior-feed-cover`

ALWAYS feed.card.media.frame wears its clip's stored still until playback first starts

ALWAYS a clip with no chosen cover shows its own frame 0 as its still

WHEN feed.card.media.frame's clip first starts playing -> the stored still gives way to playback AND NEVER the stored still returns

WHEN feed.card.media.frame's clip stops being the playing clip -> it freezes on the frame it reached AND NEVER the stored still returns

WHEN a clip on a card plays to its end -> it loops

ALWAYS feed.card.media.frame carries feed.card.media.frame.soundDisc and no other control GIVEN the device allows autoplay

ALWAYS a clip on a card wears no play and pause, no duration and no timeline

ALWAYS feed.card.media.frame carries feed.card.media.frame.playDisc in the place of feed.card.media.frame.soundDisc GIVEN the device suppresses autoplay

ALWAYS the device suppresses autoplay GIVEN it asks for reduced motion or data saver

ALWAYS no clip on the feed starts on its own GIVEN the device suppresses autoplay

WHEN tap feed.card.media.frame.playDisc -> feed.card.media.frame's clip plays where it stands in the feed AND it becomes the stage's incumbent AND NEVER the post opens

WHEN feed.card.media.frame's clip falls below the 70% gate GIVEN it took the stage by feed.card.media.frame.playDisc -> the stage law's ordinary succession takes over

WHEN scroll settles at the feed's hard top GIVEN feed.card.media.frame's clip took the stage by feed.card.media.frame.playDisc and still qualifies -> NEVER the stage re-elects AND NEVER the clip stops

WHEN tap feed.card.media.frame.soundDisc GIVEN sound is off -> sound turns on for every clip on every surface

WHEN tap feed.card.media.frame.soundDisc GIVEN sound is on -> sound turns off for every clip on every surface

ALWAYS a clip starts muted GIVEN the reader has not turned sound on

ALWAYS a clip 16:9 or square displays at its own shape, and a clip taller than 4:5 centre-crops to 4:5

ALWAYS no clip is letterboxed

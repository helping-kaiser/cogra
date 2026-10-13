# FeedCover · `spec:design:behavior-feed-cover`

ALWAYS feed.card.media.frame wears its clip's stored still until playback first starts

ALWAYS a clip with no chosen cover shows its own frame 0 as its still

WHEN feed.card.media.frame's clip first starts playing -> the stored still gives way to playback AND NEVER the stored still returns within the reading session

WHEN feed.card.media.frame's clip stops being the playing clip -> it freezes on the frame it reached AND NEVER the stored still returns within the reading session, its card's remounts included

WHEN the app cold-launches -> feed.card.media.frame wears its clip's stored still again

WHEN the list holding feed.card refreshes -> feed.card.media.frame wears its clip's stored still again

WHEN a clip on a card plays to its end -> it loops

ALWAYS feed.card.media.frame carries feed.card.media.frame.soundDisc and no other control GIVEN the device allows autoplay or its clip is playing

ALWAYS a clip on a card wears no play and pause, no duration and no timeline

ALWAYS feed.card.media.frame carries feed.card.media.frame.playDisc in the place of feed.card.media.frame.soundDisc GIVEN the device suppresses autoplay and its clip is not playing

ALWAYS the device suppresses autoplay GIVEN it asks for reduced motion or data saver

ALWAYS no clip starts on its own on any surface GIVEN the device suppresses autoplay

WHEN tap feed.card.media.frame.playDisc -> feed.card.media.frame's clip plays where it stands in the feed AND it becomes the stage's incumbent AND NEVER the post opens

WHEN feed.card.media.frame's clip falls below the 70% gate GIVEN it took the stage by feed.card.media.frame.playDisc -> the stage law's ordinary succession takes over

WHEN scroll settles at the feed's hard top GIVEN feed.card.media.frame's clip took the stage by feed.card.media.frame.playDisc and still qualifies -> NEVER the stage re-elects AND NEVER the clip stops

WHEN tap feed.card.media.frame.soundDisc GIVEN sound is off -> sound turns on for every clip on every surface

WHEN tap feed.card.media.frame.soundDisc GIVEN sound is on -> sound turns off for every clip on every surface

ALWAYS assistive technology reaches mute and unmute as a custom action on feed.card.media.frame, the traversal inside feed.card.media staying cleared, GIVEN android and feed.card.media.frame's clip is playing

ALWAYS assistive technology reaches mute and unmute as feed.card.media.frame.soundDisc, a native focusable button whose label names the sound's state, with no aria-hidden and no inert on feed.card.media.frame's subtree GIVEN the web and feed.card.media.frame's clip is playing

ALWAYS a clip starts muted GIVEN the reader has not turned sound on

WHEN the browser refuses sound to a clip taking the stage GIVEN the web and sound is on -> the clip plays muted AND sound turns off for every clip on every surface AND NEVER the clip stays frozen

ALWAYS a clip 16:9 or square displays at its own shape, and a clip taller than 4:5 centre-crops to 4:5

ALWAYS no clip is letterboxed

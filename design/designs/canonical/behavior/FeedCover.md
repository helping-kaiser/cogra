# FeedCover · `spec:design:behavior-feed-cover`

ALWAYS a clip on a card wears the sound control and nothing else GIVEN the device allows autoplay

ALWAYS a clip on a card wears no play and pause, no duration and no timeline

ALWAYS a clip's still holds until its playback first starts

WHEN a clip's playback has started -> NEVER its still comes back

WHEN a clip on a card plays to its end -> it loops

WHEN a clip stops being the playing one -> it freezes on the frame it reached AND NEVER its still comes back

ALWAYS a clip 16:9 or square displays at its own shape, and a clip taller than 4:5 centre-crops to 4:5

ALWAYS no clip is letterboxed

ALWAYS a clip with no chosen cover shows its own frame 0 as its still

WHEN the device suppresses autoplay -> the card wears a play disc in the sound control's place AND NEVER the clip starts on its own

WHEN tap the play disc -> the clip plays in the feed where it stands

WHEN tap the sound control -> sound turns on or off as the one sticky decision every video shares

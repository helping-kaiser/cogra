# FeedCommentShapes · `spec:design:behavior-feed-comment-shapes`

ALWAYS feed.commentCard's own pictures join its words inset, capped at a comment's height

WHEN tap feed.commentCard's own pictures -> the post's comment section opens scrolled to that comment

ALWAYS feed.commentCard.media.frame plays a comment's clip muted in the comment scale's square, carrying feed.commentCard.media.frame.soundDisc and no other control

WHEN tap feed.commentCard.media.frame.soundDisc -> sound turns on or off for every clip on every surface together

ALWAYS feed.commentCard's head row names a comment it answers by its author's handle over its first words, with the comment's own mark

ALWAYS feed.commentCard's head row names an untitled post it answers by the post's first words in the title's place, over its author, with the text post's mark

ALWAYS feed.commentCard's head row reads Removed by its author in the title's place, in the system's voice, over the author, with an empty tile GIVEN the post it answers was removed by its author

ALWAYS feed.commentCard stays readable GIVEN the post it answers was removed

ALWAYS the compact veil takes a veiled feed.commentCard's words and its head row stays readable

ALWAYS feed.commentCard's menu is the reader's own comment menu GIVEN the comment is the reader's own, and nothing else on the card changes

ALWAYS a long comment folds at two lines under More

WHEN tap More on a folded feed.commentCard -> the comment unfolds in place AND the card stays the door to its thread

WHEN a guest taps feed.commentCard's face -> the guest gate opens

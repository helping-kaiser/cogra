# FeedCommentShapes · `spec:design:behavior-feed-comment-shapes`

ALWAYS feed.commentCard's own pictures join its words inset, a square at the column's width with no cap on its height

WHEN tap feed.commentCard's own pictures -> the post's comment section opens scrolled to that comment

ALWAYS feed.commentCard.media.frame plays a comment's clip muted in the comment scale's square, carrying feed.commentCard.media.frame.soundDisc and no other control GIVEN the device allows autoplay

ALWAYS feed.commentCard.media.frame carries feed.commentCard.media.frame.playDisc in the place of feed.commentCard.media.frame.soundDisc GIVEN the device suppresses autoplay and its clip is not playing

ALWAYS feed.commentCard.media.frame carries feed.commentCard.media.frame.soundDisc and no other control GIVEN the device suppresses autoplay and its clip is playing

WHEN tap feed.commentCard.media.frame.playDisc -> feed.commentCard.media.frame's clip plays where it stands in the feed AND it becomes the stage's incumbent AND NEVER the post's comment section opens

WHEN tap feed.commentCard.media.frame.soundDisc -> sound turns on or off for every clip on every surface together

ALWAYS feed.commentCard.target names a comment it answers by its author's handle over its first words, with the comment's own mark

ALWAYS feed.commentCard.target names an untitled post it answers by the post's first words in the title's place, over its author, with the text post's mark

ALWAYS feed.commentCard.target reads Removed by its author in the title's place, in the system's voice, over the author, with an empty tile GIVEN the post it answers was removed by its author

ALWAYS feed.commentCard.target reads the comment's author's handle over Removed by its author, in the system's voice, with an empty tile, and is spoken On @tobias's removed comment GIVEN the comment it answers was removed by its author

ALWAYS feed.commentCard.target reads Deleted account, in the system's voice, where the author's handle would stand, the post's title or the comment's first words kept, and is spoken On a deleted account's comment for a comment GIVEN what it answers is a deleted account's and still there

ALWAYS feed.commentCard.target reads Removed by its author over Deleted account for a post, Deleted account over Removed by its author for a comment, with an empty tile, and is spoken On a deleted account's removed post or On a deleted account's removed comment GIVEN what it answers was a deleted account's and its content went with the account

ALWAYS feed.commentCard.target never names a removed post by its title nor a removed comment by its words, and never prints a deleted account's handle

ALWAYS feed.commentCard stays readable GIVEN the post it answers was removed

WHEN feed.commentCard.target is tapped -> the post it answers opens AND its back arrow reads Back to feed

WHEN feed.commentCard is tapped outside feed.commentCard.target and its own controls -> the post's comment section opens scrolled to that comment

WHEN feed.commentCard.target is tapped GIVEN the post it answers was removed or is a deleted account's -> the post opens AND its detail shows the mark in the content's place

ALWAYS the compact veil takes a veiled feed.commentCard's words and feed.commentCard.target stays readable

ALWAYS feed.commentCard's menu is the reader's own comment menu, Edit among its rows, GIVEN the comment is the reader's own, and nothing else on the card changes

ALWAYS a long comment folds at two lines under More

WHEN tap More on a folded feed.commentCard -> the comment unfolds in place AND the card stays the door to its thread

WHEN a guest taps feed.commentCard's face -> the guest gate opens

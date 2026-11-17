# FeedRemoved · `spec:design:behavior-feed-removed`

ALWAYS a post the reader removed from the feed stands in its own place in the feed as feed.card.removalMark, the cards around it unmoved

ALWAYS feed.card.removalMark.line reads Removed by its author

ALWAYS feed.card.removalMark carries the line and the removal's date and no detail

ALWAYS the removed card keeps feed.card.menu, its rows Save or Unsave, then Cite in a new post, then Cited by, then Opinions on this, then License terms, your own post's menu less Edit, Mark as sensitive and Remove

ALWAYS the removed card keeps feed.card.authorChip, feed.card.actionRow.stance, feed.card.actionRow.score, feed.card.actionRow.comments.count and feed.card.actionRow.share

WHEN the feed is next derived on this device, by a refresh, a cold open or a changed filter GIVEN the feed's filter keeps Removed off -> the removed card leaves the feed as every removed post does

WHEN the feed is next derived on this device GIVEN the feed's filter has Removed on -> the removed card keeps standing as its mark

ALWAYS a card of the reader's own removed off the post detail, on the own profile's Posts and Comments tabs or as a comment card in the feed, stands as its mark in its place until that surface is next derived

WHEN tap feed.card.actionRow.comments -> the thread opens with every response in it

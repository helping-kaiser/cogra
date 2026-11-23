# TagPage · `spec:design:behavior-tag-page`

ALWAYS the tag page is titled by the tag, # and all

ALWAYS tagPage.header.title stands on one line and ends in … GIVEN the tag's name is too long for it

ALWAYS tagPage.name prints the tag's whole name, # and all, under the header and above the topic's row, wrapping at its hyphens and breaking inside the name where a run has none, GIVEN the name is too long for the header's one line

ALWAYS tagPage.name stands at the largest whole pixel from the title role's 22px down at which the whole name holds two lines, never below 12px, its line-height round(size × 28 / 22) px, the profile head's two-line rule with a floor

ALWAYS tagPage.name stands at 12px on as many lines as it needs there GIVEN the whole name holds two lines at no size down to 12px

ALWAYS tagPage.name is never cut and is hidden from assistive technology, the header's title speaking the whole name

ALWAYS no heading stands under the header GIVEN the tag's name fits the header's one line

ALWAYS tagPage.name is the one place a tag's name wraps

ALWAYS the tag page carries no bottom bar

ALWAYS the tag page's header carries no control, and the topic's stance row stands under the title above every post

ALWAYS the tag page offers no order control, no pagination and no load-more, and its list ends where its limit does

ALWAYS the tag page lists its tagged content newest claim first

ALWAYS the tag page lists only claims whose author is the content's own author

ALWAYS a tagged post stands as a post card and a tagged comment as tagPage.commentCard leading with the thread it answers

ALWAYS a tagged comment's card offers no Reply and no view-replies line

ALWAYS tagPage.commentCard carries tagPage.commentCard.tagsLine, its tags as tagPage.commentCard.tagsLine.tag and its count as tagPage.commentCard.tagsLine.counts, as a comment carries it in the feed

WHEN tap tagPage.commentCard.tagsLine.counts -> the comment's tags-and-references sheet rises over the tag page, as a feed card's count opens it

WHEN tap tagPage.commentCard.tagsLine.tag -> that tag's page opens

ALWAYS a tagged comment's ⋮ holds the comment's whole menu, the reader's comment menu on someone else's, removed or not, and the own comment menu on the reader's own, less Edit and Remove once it was removed

ALWAYS a tagged comment's pointer names a removed post it answers by its author's handle, as On @sol's removed post, and never by its title

WHEN tagPage.commentCard.target is tapped GIVEN it names a post -> the post it answers opens AND its back arrow reads Back to #saltmaps

WHEN tagPage.commentCard.target is tapped GIVEN it names a comment -> the post's comment section opens scrolled to the comment it names

WHEN tagPage.commentCard is tapped outside tagPage.commentCard.target and its own controls -> the post's comment section opens scrolled to that comment

WHEN the tag page is next derived GIVEN the feed's filter has Removed on -> a removed tagged post stands in its row as the feed's removed card AND a removed tagged comment stands in its row as tagPage.commentCard with tagPage.commentCard.removalMark in the words' place, each Removed by its author with the removal's date, under its claim

WHEN the tag page is next derived GIVEN the feed's filter keeps Removed off -> a removed tagged post or comment is not listed AND NEVER the tag page carries a switch of its own

ALWAYS every row carries the claim above it, its exact pair painting only in geek mode

ALWAYS the tag page shows no count of people or of uses

ALWAYS a card's score on the tag page is the figure the latest fetch of its thing found — the reader's own last feed fetch, or its trace's fetch since — a dash only where that fetch found none

ALWAYS a card's score on the tag page prints as every feed card's does, two decimals and never more, 0.01 or −0.01 GIVEN a computed figure is not zero and under 0.005 either way

ALWAYS at most one clip plays on the tag page, by the feed's stage law

WHEN tap a portrait or square clip on the tag page -> the stream opens on it, carrying only the clips tagged with this tag that are at least as tall as they are wide, in the tag page's order AND the bar keeps the root the tag page was opened from

WHEN tap a clip wider than tall on the tag page -> the post opens

WHEN scroll settles at the tag page's hard top GIVEN a qualifying clip exists and the device allows autoplay -> the stage re-elects to the first qualifying clip in the tag page's order

WHEN an overscroll bounce settles back at the tag page's hard top GIVEN a qualifying clip exists and the device allows autoplay -> the stage re-elects to the first qualifying clip in the tag page's order

ALWAYS the word follow appears nowhere on the tag page

WHEN tap the back arrow -> the reader returns to where they came from AND the arrow's label names that origin

ALWAYS the back arrow reads Back to Explore from Explore at rest, Back to the search from Explore mid-query, Back to Your tags from Your tags, Back to feed from the feed in any of its states, Back to the post from a post's tags-and-references sheet, Back to the comments from a comment's chips in the thread, Back to the profile from a card on another's profile, Back to your profile from a card on the reader's own, Back to Saved from Saved, Back to History from History and Back to with the other tag's name from another tag's page

ALWAYS the back arrow reads Back to Explore and leads to Explore GIVEN the page was entered with no history behind it

WHEN a guest reaches the tag page -> the page shows what is tagged AND every stance face wears the borrowed view's own stance, read-only, and the hollow face wherever the borrowed view holds none AND the scores come from the genesis vantage

ALWAYS the topic's wide anchor's words beside the hollow face name the borrowed view, as @genesis_mod's opinion, its handle ellipsized before 's opinion where the name outgrows the anchor, as @genesis…'s opinion, GIVEN the reader is a guest and the borrowed view holds no opinion on the topic

ALWAYS the topic's wide anchor's accessible name keeps the borrowed view's full handle, never ellipsized GIVEN the reader is a guest

ALWAYS every stance anchor on the tag page is spoken as the borrowed view's opinion, as @genesis_mod's opinion on this post, its reading after it where the view holds one, GIVEN the reader is a guest

WHEN a guest taps a stance face on the tag page -> the guest gate opens over the tag page

WHEN a press-and-hold on the topic's stance face lands -> a positive Affinity is signed AND the topic is held

WHEN tap the topic's stance face GIVEN the topic is not held -> the pad blooms with the master's three controls

WHEN the page's first read gets no answer -> the header stands AND the line Can't reach the server — this tag can't load right now. stands in the page's place over an outlined Retry AND NEVER the stance row or a card stands

WHEN tap Retry -> the page is read again AND it answers as the read does

WHEN a link or a typed address opens a tag page GIVEN its name cannot be a tag name, breaking the naming gate -> the header keeps the name asked for, on one line ending in … where it is too long, AND no full-name heading stands AND the page reads This tag doesn't exist. in the page's place AND NEVER the stance row, a card or a Retry stands

ALWAYS the page for a name that cannot be a tag is the answer no, never the failure voice and never the error colour, and nothing on it retries

ALWAYS a legal name nothing carries opens the tag page empty, reading Nothing carries this tag right now., and never This tag doesn't exist.

# LadderTopics · `spec:design:behavior-ladder-topics`

ALWAYS a card's tags and citations stand on one line whatever their count, on the feed card and on the detail alike

ALWAYS the line shows at most two tags whole as chips, then states the rest in words, as · 23 tags · 3 references

ALWAYS a tag is never cut to make room, and a tag that does not fit whole folds into the count instead

ALWAYS the chips that show are always the first of the post's tags, never a later, shorter one in place of an earlier one

ALWAYS the line falls to its words alone, as · 1 tag, GIVEN not even the first tag fits whole

ALWAYS the line never wraps and never grows a second row

WHEN tap a tag's chip on a feed card -> that tag's page opens

WHEN tap the counts on a feed card -> the tags-and-references sheet opens

WHEN tap the line on the detail -> the tags-and-references sheet opens AND NEVER a chip inside it opens a tag's page

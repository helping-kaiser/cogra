# ExploreSearch · `spec:design:behavior-explore-search`

WHEN the reader types in explore.searchField -> the results refine as the reader types

ALWAYS full matches stand before partial matches, a full match being a name or title equal to the query, case aside, each tier ordered by the reader's ranker and never newest by default GIVEN the order is Ranked

ALWAYS what the ranker cannot score stands behind a visible seam, newest first GIVEN the order is Ranked

ALWAYS the results stand in the search's sections, people, then topics, then content, under either order

ALWAYS each section stands its own ranked head and then its own rest, and explore.seam closes the head of each section that has a rest, one per section, keyed people, topics or content GIVEN the order is Ranked

ALWAYS explore.searchField.clear stands at the field's end, spoken Clear search, GIVEN a query stands in explore.searchField

WHEN tap explore.searchField.clear -> the query empties AND explore.searchField keeps the focus AND Explore at rest stands again with its recent searches

ALWAYS a row past the seam but a tag or a person shows its age in place of its rank, in the one age ladder: now, 35m, 2h, 3d up to 30 days, then the date as 06.09.2024

ALWAYS a tag or a person row past the seam carries nothing on its right edge

ALWAYS a ranked row carries its viewer-relative rank on its right edge beside the score's graph glyph

ALWAYS a tag result carries the reader's rank and never a use count GIVEN the order is Ranked

ALWAYS explore.filterTrigger reads Everything GIVEN the search filter is at its default

ALWAYS explore.filterTrigger's spoken name is its reading followed by what the search shows

ALWAYS a result the reader has already seen stays out GIVEN Show what you've already seen is off

ALWAYS search matches names and titles, and never a body, a description or a bio

ALWAYS plain text matches a person when any word of their display name or their handle starts with what is typed, as Mod finds Genesis Moderator and enesis finds nobody, and never needs an @

ALWAYS plain text matches a thing when any word of its title, of its author's display name or of its author's handle starts with what is typed

ALWAYS a comment result appears only for a query scoped by @handle or #tag

ALWAYS an indirect result's second line names the target it was found through

ALWAYS search returns no item, offer or message rows

WHEN the query is a bare @handle with no text after it -> the people whose handle starts with what is typed stand first, as @sol surfaces @solarium, AND the things those people authored follow them AND NEVER the full handle is needed

WHEN the query is a bare #tag with no text after it -> the tags whose name starts with what is typed stand first AND the things that carry those tags follow them

ALWAYS a query scoped by @handle reaches every person whose handle starts with what is typed, and never needs the full handle

ALWAYS a query scoped by #tag reaches the things that carry the tag, the tag page's own set, its text matching a carried post's title and a carried comment's target's title

ALWAYS a query scoped by @handle also returns the tags that person tagged with, each reading tagged by @sol on its second line

ALWAYS a reply found under @handle is found through its thread's root post, its second line reading on and the root post's title

ALWAYS a query scoped by @handle with text after it returns no profile row

ALWAYS a sensitive result stands as the reader's sensitive setting has it, as the text T tile and never its cover, its title readable

ALWAYS a removed thing never matches

ALWAYS still-settling content is searchable, and its row shows nothing extra

WHEN a keystroke refines the query -> the rows on screen stay readable until the answer AND NEVER Loading… shows within 200ms

WHEN the refine has not answered 200ms after the keystroke -> Loading… shows, by the loading ladder

WHEN a refine fails GIVEN rows are on screen -> the rows stay AND Couldn't load more with Retry stands at the head of the results

WHEN a read fails GIVEN nothing is loaded -> Can't reach the server — results can't load right now. over an outlined Retry stands in the results' place AND NEVER the line says try again

WHEN tap Retry -> the failed read is asked again

ALWAYS a guest's results stand newest first, each row but a tag or a person with its age, no row with a rank, and no explore.seam stands GIVEN the reader is a guest

ALWAYS an applicant's search reads as a member's

ALWAYS the order is Newest GIVEN the ranker does not serve the search yet

ALWAYS full matches stand before partial matches, each tier newest first GIVEN the order is Newest

ALWAYS explore.seam is absent and no row carries a rank GIVEN the order is Newest

ALWAYS every result but a tag or a person carries its age on its right edge, in the one ladder of ages GIVEN the order is Newest

ALWAYS a tag or a person result carries nothing on its right edge, never an age, a rank or a use count GIVEN the order is Newest

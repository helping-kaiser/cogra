# ExploreSearch · `spec:design:behavior-explore-search`

WHEN the reader types in explore.searchField -> the results refine as the reader types

ALWAYS full matches stand before partial matches, a full match being a name or title equal to the query, case aside, each tier ordered by the reader's ranker and never newest by default GIVEN the order is Ranked

ALWAYS what the ranker cannot score stands behind a visible seam, newest first GIVEN the order is Ranked

ALWAYS a row past the seam shows its age in place of its rank, in the one age ladder: now, 35m, 2h, 3d up to 30 days, then the date as 06.09.2024

ALWAYS a ranked row carries its viewer-relative rank on its right edge beside the score's graph glyph

ALWAYS a tag result carries the reader's rank and never a use count GIVEN the order is Ranked

ALWAYS explore.filterTrigger reads Everything GIVEN the search filter is at its default

ALWAYS explore.filterTrigger's spoken name is its reading followed by what the search shows

ALWAYS a result the reader has already seen stays out GIVEN Show what you've already seen is off

ALWAYS search matches names and titles, and never a body, a description or a bio

ALWAYS a comment result appears only for a query scoped by @handle or #tag

ALWAYS an indirect result's second line names the target it was found through

ALWAYS search returns no item, offer or message rows

WHEN the query is a bare @handle with no text after it -> the results propose the people whose handle starts with what is typed, as @sol surfaces @solarium AND NEVER anyone's contents are listed

WHEN the query is a bare #tag with no text after it -> the results propose the tags whose name starts with what is typed AND NEVER a tag's contents are listed

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

WHEN a read fails GIVEN nothing is loaded -> Can't reach the server. Check your connection and try again. with Retry stands in the results' place

WHEN tap Retry -> the failed read is asked again

ALWAYS a guest's results stand newest first, each row with its age and no rank, and no explore.seam stands GIVEN the reader is a guest

ALWAYS an applicant's search reads as a member's

ALWAYS the order is Newest GIVEN the ranker does not serve the search yet

ALWAYS full matches stand before partial matches, each tier newest first GIVEN the order is Newest

ALWAYS explore.seam is absent and no row carries a rank GIVEN the order is Newest

ALWAYS every result but a tag carries its age on its right edge, in the one ladder of ages GIVEN the order is Newest

ALWAYS a tag result carries nothing on its right edge, never an age, a rank or a use count GIVEN the order is Newest

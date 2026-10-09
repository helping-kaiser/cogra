# ExploreSearch · `spec:design:behavior-explore-search`

WHEN the reader types in explore.searchField -> the results refine as the reader types

ALWAYS full matches stand before partial matches, each tier ordered by the reader's ranker and never newest by default GIVEN the order is Ranked

ALWAYS what the ranker cannot score stands behind a visible seam, newest first GIVEN the order is Ranked

ALWAYS a row past the seam shows its age in place of its rank, relative within one year and an absolute date after

ALWAYS a ranked row carries its viewer-relative rank on its right edge beside the score's graph glyph

ALWAYS a tag result carries the reader's rank and never a use count GIVEN the order is Ranked

ALWAYS explore.filterTrigger reads Everything GIVEN the search filter is at its default

ALWAYS explore.filterTrigger's spoken name is its reading followed by what the search shows

ALWAYS a result the reader has already seen stays out GIVEN Show what you've already seen is off

ALWAYS search matches names and titles, and never a body, a description or a bio

ALWAYS a comment result appears only for a query scoped by @handle or #tag

ALWAYS an indirect result's second line names the target it was found through

ALWAYS search returns no item, offer or message rows

ALWAYS the order is Newest GIVEN the ranker does not serve the search yet

ALWAYS full matches stand before partial matches, each tier newest first GIVEN the order is Newest

ALWAYS explore.seam is absent and no row carries a rank GIVEN the order is Newest

ALWAYS every result but a tag carries its age on its right edge, in the one ladder of ages GIVEN the order is Newest

ALWAYS a tag result carries nothing on its right edge, never an age, a rank or a use count GIVEN the order is Newest

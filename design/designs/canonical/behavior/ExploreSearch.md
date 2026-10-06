# ExploreSearch · `spec:design:behavior-explore-search`

WHEN the reader types in explore.searchField -> the results refine as the reader types

ALWAYS full matches stand before partial matches, each tier ordered by the reader's ranker and never newest by default

ALWAYS what the ranker cannot score stands behind a visible seam, newest first

ALWAYS a row past the seam shows its age in place of its rank, relative within one year and an absolute date after

ALWAYS a ranked row carries its viewer-relative rank on its right edge beside the score's graph glyph

ALWAYS a tag result carries the reader's rank and never a use count

ALWAYS explore.filterTrigger reads Everything GIVEN the search filter is at its default

ALWAYS explore.filterTrigger's spoken name is its reading followed by what the search shows

ALWAYS a result the reader has already seen stays out GIVEN Show what you've already seen is off

ALWAYS search matches names and titles, and never a body, a description or a bio

ALWAYS a comment result appears only for a query scoped by @handle or #tag

ALWAYS an indirect result's second line names the target it was found through

ALWAYS search returns no item, offer or message rows

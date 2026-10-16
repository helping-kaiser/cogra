# ExplorePerson · `spec:design:behavior-explore-person`

ALWAYS the results stand in sections, the people first under explore.peopleLabel reading People and then the content, GIVEN the query reaches a person

ALWAYS the people section holds at most three people, the first three by the search's order

ALWAYS explore.peopleDoor reads See all people and closes the people section GIVEN more than three people match

ALWAYS no explore.peopleDoor stands GIVEN three people or fewer match

ALWAYS the content after the people section stands by the search's own order, its full matches first and its seam where the order is Ranked, and never under a caption of its own

WHEN tap explore.peopleDoor -> Profiles alone becomes the search filter's kind AND the search re-queries once AND explore.filterTrigger reads Profiles

ALWAYS only the people stand, every one the query matches, with no explore.peopleLabel and no explore.peopleDoor, GIVEN Profiles alone is the search filter's kind

ALWAYS no people section stands GIVEN the search filter's kinds leave Profiles out, and a query by @handle still reaches what the matched people authored

ALWAYS a person's result row leads with their avatar, reads their display name over their @handle and carries their viewer-relative rank on its right edge beside the score's graph glyph GIVEN the order is Ranked

ALWAYS a person's result row carries nothing on its right edge, never an age or a rank GIVEN the order is Newest

WHEN tap a person's result row GIVEN the person is not the reader -> that person's profile opens AND its back arrow reads Back to the search

WHEN tap a person's result row GIVEN the person is the reader -> the reader's own profile opens

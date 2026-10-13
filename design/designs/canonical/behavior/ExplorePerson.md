# ExplorePerson · `spec:design:behavior-explore-person`

ALWAYS a person's result row leads with their avatar, reads their display name over their @handle and carries their viewer-relative rank on its right edge beside the score's graph glyph GIVEN the order is Ranked

ALWAYS a person's result row carries nothing on its right edge, never an age or a rank GIVEN the order is Newest

WHEN tap a person's result row GIVEN the person is not the reader -> that person's profile opens AND its back arrow reads Back to the search

WHEN tap a person's result row GIVEN the person is the reader -> the reader's own profile opens

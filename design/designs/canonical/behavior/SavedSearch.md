# SavedSearch · `spec:design:behavior-saved-search`

ALWAYS the matches stand in sections, the people first under saved.profilesLabel reading Profiles and then the content, GIVEN the query reaches a saved person

ALWAYS the people section holds at most three people, the newest saves among the people the query matches

ALWAYS saved.profilesDoor reads See all profiles and closes the people section GIVEN more than three saved people match

ALWAYS no saved.profilesDoor stands GIVEN three saved people or fewer match

ALWAYS the content section stands after the people section, newest first by when the reader saved each thing, and never under a caption of its own

ALWAYS every card in the sections is the same card Saved draws, fully live, and the first row of each one's ⋮ reads Unsave

WHEN tap saved.profilesDoor -> Saved narrows to the people the query matches alone, every one, newest save first AND the content section stands away AND saved.searchField keeps the query

ALWAYS no saved.profilesLabel and no saved.profilesDoor stands GIVEN Saved stands narrowed to the people alone

WHEN the reader empties saved.searchField -> Saved stands whole, newest first, by when the reader saved each thing, with no section caption

WHEN saved.profileCard is tapped -> that person's profile opens AND its back arrow reads Back to Saved

WHEN tap the back arrow -> the reader's own profile comes back, in the state it was left

ALWAYS the back arrow reads Back to your profile

ALWAYS saved.bottomBar keeps lit the slot of the root Saved was opened from, saved.bottomBar.profileSlot

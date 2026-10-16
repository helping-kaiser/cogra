# HistorySearch · `spec:design:behavior-history-search`

ALWAYS the matches stand in sections, the people first under history.profilesLabel reading Profiles and then the content, GIVEN the query reaches a person in History

ALWAYS the people section holds at most three people, the ones the reader first saw most recently among the people the query matches

ALWAYS history.profilesDoor reads See all profiles and closes the people section GIVEN more than three people in History match

ALWAYS no history.profilesDoor stands GIVEN three people in History or fewer match

ALWAYS the content section stands after the people section, ordered by the time the reader first saw each thing, newest first, and never under a caption of its own

ALWAYS every card in the sections is the same card History draws, fully live

WHEN tap history.profilesDoor -> Profiles alone becomes the history's filter kind AND History re-reads once AND history.filterTrigger reads Profiles AND history.searchField keeps the query

ALWAYS only the people stand, every one the query matches, with no history.profilesLabel and no history.profilesDoor, GIVEN Profiles alone is the history's filter kind

ALWAYS no people section stands GIVEN the history's filter kinds leave Profiles out, and a query by @handle still reaches what the matched people authored

WHEN the reader empties history.searchField -> History stands whole as the filter has it, ordered by the time the reader first saw each thing, newest first, with no section caption

WHEN history.profileCard is tapped -> that person's profile opens AND its back arrow reads Back to History

WHEN tap history.filterTrigger -> the history's filter sheet opens over History

WHEN tap the back arrow -> the reader's own profile comes back, in the state it was left

ALWAYS the back arrow reads Back to your profile

ALWAYS history.bottomBar keeps lit the slot of the root History was opened from, history.bottomBar.profileSlot

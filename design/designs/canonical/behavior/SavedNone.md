# SavedNone · `spec:design:behavior-saved-none`

ALWAYS the list reads Nothing you've saved carries that name. Search reads names and titles, never bodies — fewer words reach further. GIVEN the query matches nothing in Saved

ALWAYS saved.searchField keeps the reader's query

ALWAYS Show everything stands under the line as the empty state's one action

ALWAYS the empty state wears no error colour

WHEN tap Show everything -> the query clears AND Saved stands whole, newest first, by when the reader saved each thing

WHEN the reader types a query something in Saved carries -> the matches replace the empty state, newest first, by when the reader saved each thing

WHEN tap the back arrow -> the reader's own profile comes back, in the state it was left

ALWAYS the back arrow reads Back to your profile

ALWAYS saved.bottomBar keeps lit the slot of the root Saved was opened from, saved.bottomBar.profileSlot

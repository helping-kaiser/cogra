# SavedEmpty · `spec:design:behavior-saved-empty`

ALWAYS Saved reads Nothing saved yet. A post, a comment or a person can be saved from its own menu, and it waits here. GIVEN the reader has kept nothing

ALWAYS the empty Saved offers no action button and wears no error colour

ALWAYS the empty Saved names the save in words and never draws its glyph

WHEN the last row's Unsave lands -> the empty Saved stands with the snackbar Removed from Saved. and Undo over it

WHEN tap Undo GIVEN the empty Saved stands under the unsave's snackbar -> the row that went comes back AND Saved stands as it was before the unsave

WHEN the unsave's snackbar has stood 4s without Undo -> the snackbar clears AND the empty Saved stays

WHEN tap the back arrow -> the reader's own profile comes back, in the state it was left

ALWAYS the back arrow reads Back to your profile

# SavedUndo · `spec:design:behavior-saved-undo`

ALWAYS the snackbar reads Removed from Saved. with Undo, naming the list and never the row that went

ALWAYS the list has closed over the row that went, and nothing marks the space it was in

ALWAYS the row that went is never struck through and never stays on screen

ALWAYS the rows left keep their own Unsave and open as they did

WHEN tap Undo -> the row that went comes back AND Saved stands as it was before the unsave

WHEN tap Undo GIVEN the undo does not go through -> the row that came back stays AND saved.list.entry.second reads That didn't go through. with Retry

WHEN tap Retry on the returned row's failure line -> the restore is asked again

WHEN tap another row's Unsave GIVEN the snackbar stands -> that row leaves the list too AND the rows behind it move up AND the snackbar renews

WHEN the snackbar has stood 4s without Undo -> the snackbar clears AND the list stays without the row

WHEN tap a post's row -> the post's detail opens AND its back arrow reads Back to Saved

WHEN tap a comment's row -> the thread opens landed on that comment

WHEN tap a person's row -> that person's profile opens AND its back arrow reads Back to Saved

WHEN tap the back arrow -> the reader's own profile comes back, in the state it was left

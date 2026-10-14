# SavedUndo · `spec:design:behavior-saved-undo`

ALWAYS saved.snackbar reads Removed from Saved. with Undo on saved.snackbar.action, naming the list and never the card that went

ALWAYS the list has closed over the card that went, and nothing marks the space it was in

ALWAYS the card that went is never struck through and never stays on screen

ALWAYS the cards left stay fully live, and the first row of each one's ⋮ reads Unsave

WHEN tap Undo -> the card that went comes back AND Saved stands as it was before the unsave

WHEN tap Undo GIVEN the undo does not go through -> the card that came back stays AND the line under its face reads That didn't go through. with Retry

WHEN tap Retry on the returned card's failure line -> the restore is asked again

WHEN tap Unsave on another card's ⋮ GIVEN the snackbar stands -> that card leaves the list too AND the cards behind it move up AND the snackbar renews

WHEN the snackbar has stood 4s without Undo -> the snackbar clears AND the list stays without the card

WHEN saved.commentCard's head row is tapped -> the post it answers opens AND its back arrow reads Back to Saved

WHEN saved.commentCard is tapped outside its head row and its own controls -> the post's comment section opens scrolled to that comment AND the post's back arrow beneath the thread reads Back to Saved

WHEN saved.profileCard is tapped -> that person's profile opens AND its back arrow reads Back to Saved

WHEN tap the back arrow -> the reader's own profile comes back, in the state it was left

# Saved · `spec:design:behavior-saved`

ALWAYS Saved is one mixed list of the posts, comments and people the reader kept, never a tab per kind

ALWAYS Saved stands newest first, by when the reader saved each thing

ALWAYS a row's trailing age is when the reader saved the thing, never when it was written

ALWAYS a person's row leads with their picture, and a post's or a comment's row with its kind's glyph

ALWAYS a post's cover is never a row's disc

ALWAYS Saved carries no kind label, no filter and no section headings

ALWAYS a comment's row names the post it answers on its second line, as on with the post's title

ALWAYS every row carries its own Unsave, the filled bookmark alone with no word on screen, in the chevron's slot outboard of the age

ALWAYS the header collapses on the way down and returns on the way up

ALWAYS the bottom bar rides with no slot lit

WHEN tap a post's row -> the post's detail opens AND its back arrow reads Back to Saved

WHEN tap a comment's row -> the thread opens landed on that comment

WHEN tap a person's row -> that person's profile opens AND its back arrow reads Back to Saved

WHEN tap a row's Unsave -> the row leaves the list AND the rows behind it move up AND the snackbar reads Removed from Saved. with Undo AND NEVER a dialog asks AND NEVER anything marks the space the row was in

WHEN a row's Unsave lands -> focus moves to the next row, else the previous, else the empty state

WHEN tap a row's Unsave GIVEN the unsave does not go through -> the row comes back AND the target's row says That didn't go through. with Retry

WHEN tap a row's Unsave GIVEN it was the last row -> the empty Saved stands under the same snackbar, Removed from Saved. with Undo

ALWAYS an unsave changes nothing about the thing itself, which still stands, still ranks and still opens

WHEN tap the back arrow -> the reader's own profile comes back, in the state it was left

ALWAYS the back arrow reads Back to your profile

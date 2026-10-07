# Saved · `spec:design:behavior-saved`

ALWAYS Saved is one mixed list of the posts, comments and people the reader kept, never a tab per kind

ALWAYS Saved stands newest first, by when the reader saved each thing

ALWAYS a row's trailing age is when the reader saved the thing, never when it was written

ALWAYS a person's row leads with their picture, and a post's or a comment's row with its kind's glyph

ALWAYS a post's cover is never a row's disc

ALWAYS Saved carries no kind label, no filter and no section headings

ALWAYS a comment's row names its thread's post on its second line, as on with the post's title, a reply's included

ALWAYS every row carries its own Unsave, the filled bookmark alone with no word on screen, in the chevron's slot outboard of the age

ALWAYS the header collapses on the way down and returns on the way up

ALWAYS saved.bottomBar keeps lit the slot of the root Saved was opened from, saved.bottomBar.profileSlot

WHEN tap a post's row -> the post's detail opens AND its back arrow reads Back to Saved

WHEN tap a comment's row -> the thread opens landed on that comment

WHEN tap a person's row -> that person's profile opens AND its back arrow reads Back to Saved

WHEN tap a row's Unsave -> the row leaves the list AND the rows behind it move up AND the snackbar reads Removed from Saved. with Undo AND NEVER a dialog asks AND NEVER anything marks the space the row was in

WHEN a row's Unsave lands -> focus moves to the next row, else the previous, else the empty state

WHEN tap a row's Unsave GIVEN the unsave does not go through -> the row comes back AND saved.list.entry.second reads That didn't go through. with Retry AND saved.list.entry.unsave stays

WHEN tap Retry on a row's failure line -> the unsave is asked again AND the row leaves the list again

WHEN tap a row's Unsave GIVEN it was the last row -> the empty Saved stands under the same snackbar, Removed from Saved. with Undo

ALWAYS an unsave changes nothing about the thing itself, which still stands, still ranks and still opens

ALWAYS a removed post's or comment's row stays, saved.list.entry.title reading Removed by its author in the system's voice GIVEN its author removed it or it was redacted

WHEN tap a removed thing's row -> the removed page opens AND its back arrow reads Back to Saved

ALWAYS a deleted account's row wears the reserved disc and reads Deleted account, with no saved.list.entry.aside

ALWAYS a sensitive thing's row keeps saved.list.entry.title readable, and saved.list.entry.second gives way to its sensitive reason

ALWAYS a hidden account's things and profile stay in Saved

ALWAYS a comment's row takes the comment's first line as saved.list.entry.title

ALWAYS a comment with no words takes Pictures by @ada or A video by @ada as saved.list.entry.title, as a media post is named

ALWAYS a titled media post's saved.list.entry.second reads its description, and drops when it has none

ALWAYS an untitled words post's saved.list.entry.second reads the rest of its words, and an untitled media post's row carries no saved.list.entry.second

ALWAYS saved.list.entry.aside drops GIVEN saved.list.entry.title already names the handle

ALWAYS a person with no display name takes the handle as saved.list.entry.title, with no saved.list.entry.aside

ALWAYS a person with no bio carries no saved.list.entry.second

WHEN tap the back arrow -> the reader's own profile comes back, in the state it was left

ALWAYS the back arrow reads Back to your profile

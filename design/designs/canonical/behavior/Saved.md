# Saved · `spec:design:behavior-saved`

ALWAYS Saved is one mixed list of the posts, comments and people the reader kept, never a tab per kind

ALWAYS Saved is a feed of every saveable kind, each as its own feed card: a post as saved.card, a comment as saved.commentCard and a person as saved.profileCard

ALWAYS every card in Saved is the same card the feed draws, fully live, and Saved draws no card of its own

ALWAYS Saved stands newest first, by when the reader saved each thing, never by when it was written or seen

ALWAYS a card in Saved carries no age of the save, only the age the feed card itself carries

ALWAYS the score on a card in Saved is the figure the same card wears on the feed, and the scores never order Saved

ALWAYS every card's row reads the opinion, then the score, then the kind's own act, then the share

ALWAYS a saved.commentCard carries no view-replies line

ALWAYS Saved carries no kind filter, no kind label and no section headings

ALWAYS the first row of every card's ⋮ in Saved reads Unsave, the card's own Save standing in its kept state

ALWAYS no card in Saved carries a saved mark and no card carries an unsave control of Saved's own

WHEN saved.commentCard's head row is tapped -> the post it answers opens AND its back arrow reads Back to Saved

WHEN saved.commentCard is tapped outside its head row and its own controls -> the post's comment section opens scrolled to that comment AND the post's back arrow beneath the thread reads Back to Saved

WHEN the comment glyph on a saved.commentCard is tapped -> the post's comment section opens scrolled to that comment AND the reply composer opens aimed at that comment

WHEN a post's media is tapped -> the post opens as it does from the feed AND its back arrow reads Back to Saved

WHEN saved.profileCard is tapped -> that person's profile opens AND its back arrow reads Back to Saved

WHEN a card's Feed score is tapped -> the score's trace opens AND its back arrow reads Back to Saved

WHEN tap Unsave on a card's ⋮ -> the sheet closes AND the card leaves the list AND the cards behind it move up AND saved.snackbar reads Removed from Saved. with Undo on saved.snackbar.action AND NEVER a dialog asks AND NEVER anything marks the space the card was in

WHEN a card's unsave lands -> focus moves to the next card, else the previous, else the empty state

WHEN tap Unsave on a card's ⋮ GIVEN the unsave does not go through -> the card comes back in its place AND the line under its face reads That didn't go through. with Retry AND the first row of its ⋮ still reads Unsave AND NEVER the snackbar carries the failure

WHEN tap Retry on a card's failure line -> the unsave is asked again AND the card leaves the list again

WHEN an unsave reverts GIVEN its snackbar stands -> the snackbar clears

WHEN tap Unsave on a card's ⋮ GIVEN it was the last card -> the empty Saved stands under the same snackbar, Removed from Saved. with Undo

WHEN tap Unsave on a card's ⋮ GIVEN it was the last card a query narrowed Saved to -> Saved stands narrowed to nothing, with Show everything, under the same snackbar

ALWAYS an unsave changes nothing about the thing itself, which still stands, still ranks and still opens

WHEN the reader comes back to Saved GIVEN they unsaved a thing inside a page opened from it -> that thing's card is gone AND NEVER a snackbar appears

ALWAYS a thing removed after it was saved keeps its place in Saved and wears its removal mark

WHEN tap a removed thing's card -> the removed page opens AND its back arrow reads Back to Saved

ALWAYS a deleted account's saved.profileCard stands redacted, reading Deleted account by the reserved disc, with no handle and no bio

ALWAYS sensitive content in Saved keeps its veil, as on the feed

ALWAYS a hidden account's things and profile stay in Saved

WHEN a press-and-hold on a card's stance face signs -> the face refuses a second press-and-hold until the signing answers AND NEVER the face moves before the signature is taken

WHEN the hold's signing has not answered 200ms after the hold -> the line under the face reads Signing… AND NEVER a spinner appears

WHEN the hold's signing answers within 200ms of the hold -> NEVER the line Signing… appears

WHEN the hold's signing is taken -> the face moves to the new opinion AND the snackbar confirms the signature

WHEN the hold's signing does not go through -> the face stays where it was AND the line under it reads That didn't sign. followed by Retry AND NEVER the snackbar carries the failure

WHEN the hold's signing is refused by the write rule -> the face stays where it was AND the line under it reads You can't sign right now. AND NEVER Retry appears AND NEVER the line takes the failure voice

ALWAYS at most one clip plays in Saved, by the feed's stage law

WHEN scroll settles at Saved's hard top GIVEN a qualifying clip exists and the device allows autoplay -> the stage re-elects to the first qualifying clip in Saved's order

WHEN an overscroll bounce settles back at Saved's hard top GIVEN a qualifying clip exists and the device allows autoplay -> the stage re-elects to the first qualifying clip in Saved's order

ALWAYS a veiled clip has no playback and no sound-disc presence

ALWAYS saved.searchField reads Search what you saved at rest

WHEN the reader types in saved.searchField -> Saved narrows to what matches AND the matches stand newest first, by when the reader saved each thing

ALWAYS saved.searchField matches by the one search rule Explore uses: names and titles, and never a body, a description or a bio

WHEN the query starts with @handle -> the remainder matches that person's own things in Saved, a comment through the title of what it answers and a reply through its thread's root post's title

WHEN the query starts with #tag -> the remainder matches the things in Saved that carry that tag, a carried post through its title and a carried comment through its target's title

WHEN the query is a bare @handle with no text after it -> Saved narrows to the people in it whose name starts with what is typed AND NEVER anyone's contents are listed

WHEN the query is a bare #tag with no text after it -> Saved stands narrowed to nothing, with Show everything AND NEVER anyone's contents are listed

WHEN the reader types a query nothing in Saved carries -> Saved stands narrowed to nothing, with Show everything

WHEN pull down GIVEN Saved stands all the way at its top -> Saved re-reads AND the platform's own refresh indicator shows

WHEN the next page of Saved does not arrive -> the cards on screen stay AND Couldn't load more with Retry ends the list

WHEN the reader scrolls back up far enough to summon the collapsing top GIVEN Saved is 3 viewport-heights deep or more -> the Back to top pill rides in with the top, centred under it

WHEN the reader scrolls back up far enough to summon the collapsing top GIVEN Saved is shallower than 3 viewport-heights -> NEVER the Back to top pill appears

WHEN tap Back to top -> the list goes to the top, animated AND NEVER Saved re-reads

ALWAYS the header and saved.searchField collapse on the way down and return on the way up

ALWAYS saved.bottomBar keeps lit the slot of the root Saved was opened from, saved.bottomBar.profileSlot

WHEN tap the back arrow -> the reader's own profile comes back, in the state it was left

ALWAYS the back arrow reads Back to your profile

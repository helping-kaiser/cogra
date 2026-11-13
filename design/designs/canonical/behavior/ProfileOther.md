# ProfileOther · `spec:design:behavior-profile-other`

ALWAYS the header bar is titled with the person's handle and carries the way back alone

ALWAYS the profile carries no cover image and no banner

ALWAYS the figures read Posts, Opinions on them and Opinions by them, each labelled, and never one merged figure

ALWAYS the two opinion figures are two doors and the Posts figure is no door, each door spoken as its figure's number and visible words and nothing more, as 6 Opinions on them and 6 Opinions by them

ALWAYS the actions row reads the opinion on the person, worn wide, then Message sized by its word, then the ⋮ that closes the row

ALWAYS the wide anchor wears the muted no-opinion face GIVEN the reader holds no opinion on the person

ALWAYS the header collapses on the way down and returns on the way up

ALWAYS profile.bottomBar keeps lit the slot of the root the profile was opened from, profile.bottomBar.feedSlot from the feed

WHEN another's profile opens, from any door -> it lands on its Posts tab, profile.tabRow.postsTab lit and profile.posts below it as post cards AND NEVER it lands on Everything or Comments

WHEN tap profile.tabRow.everythingTab -> the person's chronicle stands below profile.tabRow AND the header above stays as it was

ALWAYS the chronicle stands one act to a card, newest first, each card leading with its act's disc, then its verb and snippet, its age on the trailing edge

ALWAYS a chronicle card with no destination is the same card, inert

WHEN tap the wide anchor -> the pad blooms at the lower centre of the viewport AND nothing is staged

WHEN a press-and-hold on the wide anchor signs -> the anchor refuses a second press-and-hold until the signing answers AND NEVER the anchor's face moves before the signature is taken

WHEN the hold's signing has not answered 200ms after the hold -> the line under the anchor's face reads Signing… AND NEVER a spinner appears

WHEN the hold's signing is taken -> a modest positive opinion lands on the person AND the anchor's face moves to it AND the snackbar confirms the signature

WHEN the hold's signing does not go through -> the anchor's face stays where it was AND the line under it reads That didn't sign. followed by Retry AND NEVER the snackbar carries the failure

WHEN the hold's signing is refused by the write rule -> the anchor's face stays where it was AND the line under it reads You can't sign right now. AND NEVER Retry appears AND NEVER the line takes the failure voice

WHEN tap the wide anchor GIVEN the person vouched the reader in and the reader has not vouched back -> the vouch-back pad opens

WHEN an opinion on the person is signed GIVEN the person vouched the reader in and the reader has not vouched back -> the ceremony You're part of the sky now. opens

WHEN a guest taps the wide anchor -> the guest gate opens

ALWAYS the wide anchor's words beside the hollow face name the borrowed view, as @genesismod's opinion, its handle ellipsized before 's opinion where the name outgrows the anchor, as @genesismo…'s opinion, GIVEN the reader is a guest and the borrowed view holds no opinion on the person

ALWAYS the wide anchor's accessible name keeps the borrowed view's full handle, never ellipsized GIVEN the reader is a guest

ALWAYS the wide anchor wears the locked look, visibly inactive at the disabled opacity and still tappable GIVEN the reader is an applicant

WHEN tap the wide anchor GIVEN the reader is an applicant -> the snackbar reads You can give your opinion once you're in. AND NEVER the pad blooms

WHEN press-and-hold the wide anchor GIVEN the reader is an applicant -> the snackbar reads You can give your opinion once you're in. AND NEVER anything is signed or staged

WHEN tap Message -> the chats coming-soon screen opens

WHEN a guest taps Message -> the guest gate opens

WHEN tap the ⋮ in the actions row -> the profile's menu opens over the page

WHEN tap the Opinions on figure -> the opinions page opens on this profile on its On state

WHEN tap the Opinions by figure -> the opinions page opens on this profile on its By state

WHEN tap the Posts figure -> NEVER anything happens

WHEN tap profile.tabRow.postsTab GIVEN another tab is lit -> the person's posts stand below profile.tabRow as post cards AND the header above stays as it was

WHEN tap profile.tabRow.commentsTab -> the person's comments stand below profile.tabRow as comment cards AND the header above stays as it was

WHEN tap a chronicle card for a published post -> the post's detail opens AND its back arrow reads Back to the profile

WHEN the chronicle is scrolled toward its end GIVEN more acts exist -> the next page arrives in place as the reader keeps going

WHEN the next page does not arrive -> Couldn't load more with Retry stands where the next page would have AND NEVER the line takes the error colour

WHEN tap profile.bottomBar.profileSlot -> the reader's own profile opens

WHEN tap the back arrow -> the reader returns to where they came from, in the state they left it AND the arrow's label names that origin

ALWAYS the back arrow reads Back to feed from the feed in any of its states, Back to the post from a post's author chip, opinions or references, Back to the comments from the comments sheet, Back to the stream from the stream, Back to Notifications from Notifications, Back to Saved from Saved, Back to History from History, Back to the opinions from a profile's opinions list, Back to the profile from a card on another's profile, Back to your profile from a card on the reader's own, Back to the search from Explore mid-query, Back to Invites from the people you let in on Invites and Back to with the tag's name from a tag's page

ALWAYS the back arrow reads Back to feed and leads to the feed GIVEN the profile was entered with no history behind it

WHEN a link to the profile opens GIVEN the app was already open -> the profile opens as a layer over the app's state AND the back arrow returns to exactly that state

WHEN pull down GIVEN the profile stands all the way at its top -> the profile refreshes AND the platform's own refresh indicator shows

WHEN the profile's read never reaches the server -> the profile's unreachable state stands in its place

ALWAYS profile.identity.name is shown whole on at most two lines, the named exception to the long-names rule, the head alone: at 22px on 28px it wraps at its spaces and a word wider than its line breaks inside the word, the one place a name may, and it is never cut GIVEN the display name is longer than its line

ALWAYS profile.identity.name takes the largest whole-pixel size, from 22 down in steps of 1, at which it holds two lines, its line-height round(size × 28 / 22) px, and the handle line and the rest of the head keep their sizes GIVEN at 22px it would take more than two lines, several words or one long word alike, with no smallest size: two lines are the hard cap

ALWAYS the name setting's values carry the size the two-line rule gives each sample at the head's 262px: sample and two-lines 22px on 28px, fifty 19px on 24px, one-word 20px on 25px, widest 10px on 13px — two lines are the hard cap, the size has no floor (round 47)

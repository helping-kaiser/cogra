# ProfileOther · `spec:design:behavior-profile-other`

ALWAYS the header bar is titled with the person's handle and carries the way back alone

ALWAYS the profile carries no cover image and no banner

ALWAYS the figures read Posts, Opinions on them and Opinions by them, each labelled, and never one merged figure

ALWAYS the figures are one tap target, spoken as Opinions on and by with the person's handle

ALWAYS the actions row reads the opinion on the person, worn wide, then Message sized by its word, then the ⋮ that closes the row

ALWAYS the wide anchor wears the muted no-opinion face GIVEN the reader holds no opinion on the person

ALWAYS the header collapses on the way down and returns on the way up

ALWAYS the bottom bar rides with no slot lit

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

WHEN tap the wide anchor GIVEN the reader is an applicant whose application is live and an opinion is already staged -> the snackbar reads Your opinion waits with your application — it arrives with you. AND NEVER the pad opens

WHEN tap the wide anchor GIVEN the reader is an applicant whose application was closed and an opinion already waits -> the snackbar reads Your opinion waits — it arrives when someone vouches you in. AND NEVER the pad opens

WHEN tap Message -> the chats coming-soon screen opens

WHEN a guest taps Message -> the guest gate opens

WHEN tap the ⋮ in the actions row -> the profile's menu opens over the page

WHEN tap the figures -> the opinions page opens on this profile

WHEN tap the Posts tab -> the person's posts stand below the tab row as post cards AND the header above stays as it was

WHEN tap the Comments tab -> the person's comments stand below the tab row as comment cards AND the header above stays as it was

WHEN tap a chronicle card for a published post -> the post's detail opens AND its back arrow reads Back to the profile

WHEN the chronicle is scrolled toward its end GIVEN more acts exist -> the next page arrives in place as the reader keeps going

WHEN the next page does not arrive -> Couldn't load more with Retry stands where the next page would have AND NEVER the line takes the error colour

WHEN tap the Profile slot -> the reader's own profile opens

WHEN tap the back arrow -> the reader returns to where they came from, in the state they left it AND the arrow's label names that origin

ALWAYS the back arrow reads Back to feed from the feed in any of its states, Back to the post from a post's author chip, opinions or references, Back to the comments from the comments sheet, Back to the stream from the stream, Back to Notifications from Notifications, Back to Saved from Saved, Back to the opinions from a profile's opinions list and Back to with the tag's name from a tag's page

ALWAYS the back arrow reads Back to feed and leads to the feed GIVEN the profile was entered with no history behind it

WHEN a link to the profile opens GIVEN the app was already open -> the profile opens as a layer over the app's state AND the back arrow returns to exactly that state

WHEN pull down GIVEN the profile stands all the way at its top -> the profile refreshes AND the platform's own refresh indicator shows

WHEN the profile's read never reaches the server -> the profile's unreachable state stands in its place

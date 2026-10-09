# ProfileDeleted · `spec:design:behavior-profile-deleted`

ALWAYS a deleted account's profile keeps the other-profile page's whole structure: the header, the real counts, the tabs and the chronicle of what the account did

ALWAYS the avatar is the reserved disc, with no monogram and no glyph

ALWAYS the name slot reads Deleted account in the system's quiet voice

ALWAYS no handle stands anywhere on the page, the header bar's title included

ALWAYS profile.identity.removalMark stands in the bio's place, reading Deleted by the person whose account it was over Their name and profile are gone. What they signed stays on the graph and still credits them. with the moment of the deletion

ALWAYS the mark never reads like a moderation verdict and never like a dead link

ALWAYS the chronicle carries the account's acts with their own words GIVEN the deletion took the identity alone

ALWAYS every act still stands in the chronicle with its words gone GIVEN the deletion took the content too

ALWAYS the actions row reads the opinion on the account, worn wide, then the ⋮, and carries no Message

ALWAYS the figures are one tap target, spoken as each figure's number and words — Posts, Opinions on them, Opinions by them — then opinions on and by this account

ALWAYS the wide anchor's accessible name says this account and never a handle

ALWAYS profile.bottomBar keeps lit the slot of the root the profile was opened from, profile.bottomBar.feedSlot from the feed

ALWAYS the page is reached by structure that still points at the account, an author chip or a name in a chronicle, and never by a shared handle link

WHEN a deleted account's profile opens -> profile.identity.removalMark stands in the bio's place AND the header, the real counts, the tabs and the chronicle stand around it AND NEVER the page is stripped to a notice AND NEVER the page stands without the mark AND NEVER a handle is printed or invented

WHEN tap the wide anchor -> the pad blooms at the lower centre of the viewport AND nothing is staged

WHEN a press-and-hold on the wide anchor signs -> the anchor refuses a second press-and-hold until the signing answers AND NEVER the anchor's face moves before the signature is taken

WHEN the hold's signing has not answered 200ms after the hold -> the line under the anchor's face reads Signing… AND NEVER a spinner appears

WHEN the hold's signing is taken -> a modest positive opinion lands on the account AND the anchor's face moves to it AND the snackbar confirms the signature

WHEN the hold's signing does not go through -> the anchor's face stays where it was AND the line under it reads That didn't sign. followed by Retry AND NEVER the snackbar carries the failure

WHEN the hold's signing is refused by the write rule -> the anchor's face stays where it was AND the line under it reads You can't sign right now. AND NEVER Retry appears AND NEVER the line takes the failure voice

WHEN a guest taps the wide anchor -> the guest gate opens

WHEN tap the ⋮ in the actions row -> the deleted account's menu opens over the page

WHEN tap the figures -> the opinions page opens on this account

WHEN tap profile.tabRow.postsTab -> the account's posts stand below profile.tabRow as post cards AND the header above stays as it was

WHEN tap profile.tabRow.commentsTab -> the account's comments stand below profile.tabRow as comment cards AND the header above stays as it was

WHEN tap a chronicle card for a published post -> the post's detail opens AND its back arrow reads Back to the profile

WHEN tap profile.bottomBar.profileSlot -> the reader's own profile opens

WHEN tap the back arrow -> the reader returns to where they came from, in the state they left it AND the arrow's label names that origin

ALWAYS the back arrow reads Back to feed and leads to the feed GIVEN the page was entered with no history behind it

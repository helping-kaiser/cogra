# ProfileOtherHeld · `spec:design:behavior-profile-other-held`

ALWAYS the held profile is the other person's profile in the state the reader's opinion brings, and differs from it only in the anchor

ALWAYS the wide anchor carries the face of the opinion the reader holds on the person

ALWAYS the exact pair paints inside the anchor's own space, beside the face, only in geek mode

ALWAYS the anchor's accessible name carries the exact pair in both reading modes

ALWAYS Message keeps its own width and the ⋮ its place in both reading modes, and nothing in the actions row moves between them

ALWAYS the header bar is titled with the person's handle and carries the way back alone

ALWAYS the bottom bar rides with no slot lit

WHEN tap the wide anchor -> the pad blooms at the lower centre of the viewport AND nothing is staged

WHEN a press-and-hold on the wide anchor signs -> the anchor refuses a second press-and-hold until the signing answers AND NEVER the anchor's face moves before the signature is taken

WHEN the hold's signing has not answered 200ms after the hold -> the line under the anchor's face reads Signing… AND NEVER a spinner appears

WHEN the hold's signing is taken -> another modest positive act joins the reader's opinion AND the anchor's face moves to the resulting opinion AND the snackbar confirms the signature

WHEN the hold's signing does not go through -> the anchor's face stays where it was AND the line under it reads That didn't sign. followed by Retry AND NEVER the snackbar carries the failure

WHEN the hold's signing is refused by the write rule -> the anchor's face stays where it was AND the line under it reads You can't sign right now. AND NEVER Retry appears AND NEVER the line takes the failure voice

WHEN tap Message -> the chats coming-soon screen opens

WHEN tap the ⋮ in the actions row -> the profile's menu opens over the page

WHEN tap the figures -> the opinions page opens on this profile

WHEN tap the Posts tab -> the person's posts stand below the tab row as post cards AND the header above stays as it was

WHEN tap the Comments tab -> the person's comments stand below the tab row as comment cards AND the header above stays as it was

WHEN tap a chronicle card for a published post -> the post's detail opens AND its back arrow reads Back to the profile

WHEN tap the Profile slot -> the reader's own profile opens

WHEN tap the back arrow -> the reader returns to where they came from, in the state they left it AND the arrow's label names that origin

ALWAYS the back arrow reads Back to feed and leads to the feed GIVEN the profile was entered with no history behind it

WHEN pull down GIVEN the profile stands all the way at its top -> the profile refreshes AND the platform's own refresh indicator shows

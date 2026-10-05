# Profile · `spec:design:behavior-profile`

ALWAYS the band's trailing cluster reads the gear, then chats, then the bell, and the band carries no ⋮

ALWAYS the actions row reads Edit profile, then Invites, then the ⋮ that closes the row

ALWAYS the profile carries no cover image and no banner

ALWAYS the avatar wears the monogram GIVEN the reader has no picture

ALWAYS the figures read Posts, Opinions on you and Opinions by you, each labelled, and never one merged figure

ALWAYS the figures are one tap target, spoken as Your opinions, both directions

ALWAYS Invites wears the bell's dot, never a count, and is spoken as Invites — someone is waiting GIVEN an application of the reader's is ready for their approval

ALWAYS the bottom bar's Profile slot is lit

ALWAYS the header collapses on the way down and returns on the way up

ALWAYS the chronicle's tab row reads Posts, Comments and Everything, by glyph, each named in the accessibility tree

ALWAYS the chronicle stands one act to a card, newest first, each card leading with its act's disc, then its verb and snippet, its age on the trailing edge

ALWAYS a chronicle card reads Still settling GIVEN its act still pends

ALWAYS a chronicle card with no destination is the same card, inert

ALWAYS the chronicle offers no Show more, no page numbers and no count of what is left

WHEN the chronicle is scrolled toward its end GIVEN more acts exist -> the next page arrives in place as the reader keeps going

WHEN the next page has not arrived 200ms after it was asked for -> Loading… stands where the next page will take its place AND NEVER a spinner appears

WHEN the next page does not arrive -> Couldn't load more with Retry stands where the next page would have AND NEVER the line takes the error colour

WHEN tap the gear -> Settings opens

WHEN tap chats in the band -> the chats coming-soon screen opens

WHEN tap the bell -> Notifications opens

WHEN tap the ⋮ -> the sheet holding Saved, History and Share your profile opens over the profile

WHEN tap the avatar's change badge -> the picture's crop opens AND its Next leads to the picture's own seal

WHEN tap the figures -> the opinions page opens on this profile

WHEN tap Edit profile -> the profile edit opens

WHEN tap Invites GIVEN an application waits or a link is live -> Invites opens

WHEN tap Invites GIVEN no application waits and no link is live -> Invites opens on its empty state

WHEN tap the Posts tab -> the reader's posts stand below the tab row as post cards AND the header above stays as it was

WHEN tap the Comments tab -> the reader's comments stand below the tab row as comment cards AND the header above stays as it was

WHEN tap a chronicle card for a published post -> the post's detail opens AND its back arrow reads Back to your profile

WHEN tap the Profile slot GIVEN the profile is scrolled -> the profile travels back to its top AND NEVER the profile reloads

WHEN tap the Profile slot GIVEN the profile stands at its top -> NEVER anything happens

WHEN tap the Profile slot GIVEN a screen deeper in the Profile tab's stack is showing -> the profile comes back at the scroll it was left AND NEVER the profile reloads

WHEN pull down GIVEN the profile stands all the way at its top -> the profile refreshes AND the platform's own refresh indicator shows

ALWAYS the system draws no refresh indicator of its own

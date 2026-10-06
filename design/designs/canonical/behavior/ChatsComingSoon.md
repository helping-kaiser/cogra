# ChatsComingSoon · `spec:design:behavior-chats-coming-soon`

ALWAYS the band's chats icon stands on every root band, in the same corner, between the screen's own control and the bell

WHEN tap the band's chats icon GIVEN the reader is signed in -> the coming-soon page opens reading Chats — coming soon and Your conversations will be here. AND NEVER the tap does nothing

WHEN tap Message on another's profile, its held state, its posts or its comments GIVEN the reader is signed in -> the coming-soon page opens AND NEVER the tap does nothing

ALWAYS the chats' coming-soon page serves every signed-in reader state with one face: a member, a member whose key is elsewhere, an applicant and a turned-down applicant

ALWAYS the coming-soon page offers no action and names no date

ALWAYS the chats' coming-soon page wears the header's back arrow and the bottom bar with all five slots, no slot lit

ALWAYS the back arrow reads Back to feed, Back to Explore, Back to Wallet or Back to your profile, by the root the chats icon was tapped on, and Back to the profile GIVEN it was opened from a profile's Message

WHEN tap the back arrow -> the screen it was opened from comes back, in the state it was left

WHEN press Android's system Back -> the screen it was opened from comes back, exactly as the back arrow's press brings it

WHEN tap the bottom bar's Feed -> the feed opens

WHEN tap the bottom bar's Explore -> Explore opens

WHEN tap the bottom bar's New post -> a new post's pick stage opens

WHEN tap the bottom bar's Wallet -> the wallet's coming-soon door opens

WHEN tap the bottom bar's Profile -> the reader's own profile opens

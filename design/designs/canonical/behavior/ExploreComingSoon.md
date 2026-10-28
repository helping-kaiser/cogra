# ExploreComingSoon · `spec:design:behavior-explore-coming-soon`

WHEN tap the bottom bar's Explore slot GIVEN search has not shipped -> the Explore tab's root opens reading Explore — coming soon and Search will be here. AND the Explore slot stands selected AND NEVER the tap does nothing

WHEN tap the bottom bar's Explore slot GIVEN search has shipped -> Explore opens at rest AND NEVER the coming-soon page opens

ALWAYS the Explore coming-soon page serves every reader state with one face: a member, a member whose key is elsewhere, an applicant, a turned-down applicant and a guest

ALWAYS the Explore coming-soon page offers no action and names no date

ALWAYS the Explore coming-soon page wears the bottom bar with all five slots and no back arrow

ALWAYS the band above the Explore coming-soon page carries the chats icon and the bell GIVEN the reader is signed in

ALWAYS the band and the bottom bar are the bare view's, the band carrying no bell, GIVEN the reader is a guest

WHEN tap the chats icon, New post or Profile GIVEN the reader is a guest -> the guest gate opens AND NEVER the surface behind it opens

WHEN tap Feed GIVEN the reader is a guest -> the bare view opens

WHEN tap the Explore slot GIVEN the page is scrolled -> the page returns to its top

WHEN tap the Explore slot GIVEN the page is at its top -> NEVER anything changes

WHEN press Android's system Back on the Explore coming-soon page -> Feed's root opens for the reader's state AND NEVER the app leaves from the Explore tab

WHEN press the browser's back on the Explore coming-soon page -> the browser's own history decides where it goes

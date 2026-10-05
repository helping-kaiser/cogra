# ProfileApplicant · `spec:design:behavior-profile-applicant`

ALWAYS the applicant's profile wears the member's header and layout, and differs only in its card and its states

ALWAYS the application card rides above the header, titled Waiting on with the handle of the member whose approval is in play, over What you post now arrives with you.

ALWAYS the application card never names the role inviter

ALWAYS the application card holds the ask link whole, labelled Your ask link, with its copy control and the caption It does not expire. While @mira's answer is open, it can't start a second application.

ALWAYS the application card carries no way to put it away

ALWAYS Invites wears the locked look, visibly inactive at the disabled opacity and still tappable

WHEN tap Invites -> the snackbar reads You can invite once you're in. AND NEVER a gate screen opens AND NEVER Invites opens

WHEN tap the ask link's copy control -> the ask link lands on the clipboard AND the snackbar reads Link copied

ALWAYS every act the applicant staged stands in the chronicle marked Still settling

ALWAYS the line These wait with your application and arrive with you. closes the staged acts

ALWAYS a staged opinion's card is inert

WHEN tap a staged post's card -> the post's detail opens

WHEN tap New post in the bottom bar GIVEN no post is staged yet -> the post wizard opens at its first stage

WHEN tap New post in the bottom bar GIVEN a post is already staged -> the snackbar reads Your post waits with your application — it arrives with you. AND NEVER the wizard opens

WHEN tap the Feed slot -> the applicant's own feed opens

WHEN tap the bell -> Notifications opens

WHEN tap the ⋮ -> the sheet holding Saved, History and Share your profile opens over the profile

WHEN tap the gear -> Settings opens

WHEN tap the figures -> the opinions page opens on this profile

WHEN tap the Posts tab -> the reader's posts stand below the tab row as post cards AND the header above stays as it was

WHEN tap the Comments tab -> the reader's comments stand below the tab row as comment cards AND the header above stays as it was

WHEN tap the Profile slot GIVEN the profile is scrolled -> the profile travels back to its top AND NEVER the profile reloads

WHEN tap the Profile slot GIVEN the profile stands at its top -> NEVER anything happens

WHEN pull down GIVEN the profile stands all the way at its top -> the profile refreshes AND the platform's own refresh indicator shows

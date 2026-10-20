# ProfileApplicant · `spec:design:behavior-profile-applicant`

ALWAYS the applicant's profile wears the member's header and layout, and differs only in its card and its states

ALWAYS the application card rides above the header, titled Waiting on with the handle of the member whose approval is in play, over Their approval brings you in. Until then, you can read everything. GIVEN the application is open

ALWAYS the application card never names the role inviter

ALWAYS the application card holds the ask link whole, labelled Your ask link, with its copy control and the caption It does not expire. Anyone who holds your ask can let you in — the first vouch lands it. GIVEN the application is open

ALWAYS the card wears the account-notice olive, titled @mira closed your application over That was @mira's call, and it is the only thing it decides. Your account stays exactly as it is, you can keep reading, and any member you know can vouch you in instead. GIVEN the member whose approval was in play closed the application

ALWAYS the card holds the ask link whole, labelled Ask someone you know to vouch for you, with its copy control and the caption Send it to anyone who is already in. It does not expire, and it works however many people you send it to. GIVEN the application was closed
ALWAYS the application card carries no way to put it away

ALWAYS Invites wears the locked look, visibly inactive at the disabled opacity and still tappable

WHEN tap Invites -> the snackbar reads You can invite once you're in. AND NEVER a gate screen opens AND NEVER Invites opens

WHEN tap the ask link's copy control -> the ask link lands on the clipboard AND the snackbar reads Link copied

ALWAYS profile.chronicle holds no act, and profile.chronicle.empty reads Nothing here yet. Your posts and opinions show up here once you're in.

ALWAYS profile.bottomBar.composeSlot wears the locked look, visibly inactive at the disabled opacity and still tappable

WHEN tap New post in profile.bottomBar -> the snackbar reads You can post once you're in. AND NEVER the wizard opens

WHEN tap profile.bottomBar.feedSlot -> the applicant's own feed opens

WHEN tap the bell -> Notifications opens

WHEN tap the ⋮ -> the sheet holding Saved, History and Share your profile opens over the profile

WHEN tap the gear -> Settings opens

WHEN tap the figures -> the opinions page opens on this profile

WHEN tap profile.tabRow.postsTab -> the reader's posts stand below profile.tabRow as post cards AND the header above stays as it was

WHEN tap profile.tabRow.commentsTab -> the reader's comments stand below profile.tabRow as comment cards AND the header above stays as it was

WHEN tap profile.bottomBar.profileSlot GIVEN the profile is scrolled -> the profile travels back to its top AND NEVER the profile reloads

WHEN tap profile.bottomBar.profileSlot GIVEN the profile stands at its top -> NEVER anything happens

WHEN pull down GIVEN the profile stands all the way at its top -> the profile refreshes AND the platform's own refresh indicator shows

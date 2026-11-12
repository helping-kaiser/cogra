# InvitesEmpty · `spec:design:behavior-invites-empty`

ALWAYS invites.empty.title reads No invites out yet. GIVEN no application waits and no link is live and the reader has never vouched anyone in

ALWAYS the empty Invites never stands GIVEN the reader has vouched someone in

ALWAYS invites.empty.create, Create invite, stands under the line, a filled button across the column but for invites.empty.help, the "?" trailing it in its row

ALWAYS invites.empty.help is spoken How vouching works, the dialog it opens

WHEN tap invites.empty.help -> the dialog How vouching works opens, its body A link lets someone make an account. Your vouch — the opinion you sign when you approve them — is what brings them in. and Close AND NEVER the page beneath changes

ALWAYS the empty Invites carries no bottom bar and wears no error colour

WHEN tap invites.empty.create -> the create sheet opens over the page

WHEN tap invites.header.back -> the reader's own profile comes back, in the state it was left

ALWAYS invites.header.back reads Back to your profile

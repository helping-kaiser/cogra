# InviteExpiry · `spec:design:behavior-invite-expiry`

ALWAYS invites.expirySheet stands stacked over invites.createSheet, which dims beneath it and keeps its top edge, its handle and its title visible

ALWAYS invites.expirySheet offers invites.expirySheet.expiryOption 24 hours, 7 days and 30 days, and no custom date

ALWAYS exactly one length is selected, the one invites.createSheet.options.expiry reads

WHEN tap a length -> invites.expirySheet closes onto invites.createSheet AND invites.createSheet.options.expiry reads the length picked AND NEVER a Done is asked

WHEN tap the scrim -> invites.expirySheet closes onto invites.createSheet AND invites.createSheet.options.expiry reads the length it read before

WHEN swipe invites.expirySheet down or press system Back or Escape -> invites.expirySheet closes onto invites.createSheet AND invites.createSheet.options.expiry reads the length it read before

ALWAYS nothing beneath invites.expirySheet takes a press while it is up

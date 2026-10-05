# InviteExpiry · `spec:design:behavior-invite-expiry`

ALWAYS the chooser stands stacked over the create sheet, which dims beneath it and keeps its top edge, its handle and its title visible

ALWAYS the chooser offers 24 hours, 7 days and 30 days, and no custom date

ALWAYS exactly one length is selected, the one the create sheet's Expires after row reads

WHEN tap a length -> the chooser closes onto the create sheet AND the Expires after row reads the length picked AND NEVER a Done is asked

WHEN tap the scrim -> the chooser closes onto the create sheet AND the Expires after row reads the length it read before

WHEN swipe the chooser down or press system Back or Escape -> the chooser closes onto the create sheet AND the Expires after row reads the length it read before

ALWAYS nothing beneath the chooser takes a press while it is up

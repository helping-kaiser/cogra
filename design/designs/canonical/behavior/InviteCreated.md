# InviteCreated · `spec:design:behavior-invite-created`

ALWAYS the fresh link's sheet is titled Your invite link and serves the link and nothing else

ALWAYS the link stands whole, in mono, never truncated, labelled with its use and its state and captioned with when it expires

ALWAYS the word token appears nowhere on the sheet

ALWAYS Share link stands as the sheet's primary, at the column's full width

ALWAYS the invites list stays beneath the sheet, and nothing beneath the scrim takes a tap

WHEN tap the link's copy control -> the link lands on the clipboard AND the snackbar reads Link copied

WHEN tap Share link -> the platform's own share sheet opens with the link

WHEN tap Share link GIVEN the platform has no share sheet -> the link lands on the clipboard AND the snackbar reads Link copied

WHEN tap the scrim, swipe the sheet down, press Back or press Escape -> the sheet closes onto Invites AND the new link stands under Live links

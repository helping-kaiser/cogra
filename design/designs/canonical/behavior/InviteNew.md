# InviteNew · `spec:design:behavior-invite-new`

ALWAYS the create sheet is titled New invite and holds two choices, who may use the link and how long it lives, and nothing else

ALWAYS the create sheet carries no opinion control

ALWAYS Only one person can use it stands on when the sheet opens

ALWAYS Expires after reads 7 days when the sheet opens

ALWAYS the footnote reads With it off, anyone holding the link can apply until it expires. Either way each person still needs your approval, one at a time.

ALWAYS the invites list stays beneath the sheet, and nothing beneath the scrim takes a tap

WHEN turn Only one person can use it off -> the link is staged to let anyone holding it apply until it expires AND nothing is created yet

WHEN tap Expires after -> the expiry chooser opens over the sheet, reading 24 hours, 7 days and 30 days

WHEN tap Create invite -> the link is made with the staged choices AND the sheet turns to its second stage, the fresh link

WHEN Create invite has not answered 200ms after the press -> Create invite reads Creating invite… AND NEVER a spinner appears

WHEN Create invite does not go through -> the fault answers in the network fault's grammar AND the staged choices stay as they were

WHEN tap the scrim, swipe the sheet down, press Back or press Escape -> the sheet closes onto the page beneath AND nothing is created

WHEN the sheet closes -> focus returns to the control that opened it

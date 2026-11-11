# HistoryProfileMenu · `spec:design:behavior-history-profile-menu`

WHEN tap the ⋮ on history.profileCard GIVEN the person is hidden -> history.menuSheet rises over History, unstacked AND History stands unchanged beneath its wash

ALWAYS history.menuSheet reads Save or Unsave, then Mention in a new post, then Unhide with the person's handle, then history.menuSheet.report at the sheet tail, the menu of history.profileCard with its hide row in the hidden state

ALWAYS history.menuSheet.hide reads Unhide with the person's handle GIVEN the person is hidden, and keeps its one name whatever it reads

ALWAYS nothing on history.profileCard marks that the person is hidden

WHEN tap history.menuSheet.hide GIVEN it reads Unhide -> the sheet closes AND the person is unhidden AND History stands as it stood AND history.snackbar reads @mira is unhidden — their posts can reach your feed again. with Undo AND NEVER a dialog asks

WHEN tap Undo on history.snackbar GIVEN the unhide was made from the menu -> the person is hidden again AND History stands as it stood

WHEN the unhide does not go through -> the unhide reverts AND the card the unhide was made from says That didn't go through. with Retry until Retry or the next fresh load

WHEN tap history.menuSheet.report -> the menu closes AND the confirm sheet rises over History, naming the person

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes

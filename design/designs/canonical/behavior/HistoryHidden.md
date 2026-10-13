# HistoryHidden · `spec:design:behavior-history-hidden`

WHEN tap Hide on a person in the reader's post menu opened from a card in History -> the sheet closes AND History stands as it stood, every card in its place AND history.snackbar reads @ada is hidden — their posts stay out of your feed. with Undo on history.snackbar.action AND NEVER a confirm step appears

ALWAYS nothing marks a hidden person's cards while the open History stands

WHEN History next opens or is pulled down GIVEN the hide stands -> the hidden person's posts and comments are out of History AND their own history.profileCard stays

WHEN tap Undo on history.snackbar -> the person is unhidden AND History stands as it stood AND the feed stands as it was before the hide

WHEN tap Undo on history.snackbar GIVEN the unhide does not go through -> the person stays hidden AND the card the hide was made from says That didn't go through. with Retry until Retry or the next fresh load

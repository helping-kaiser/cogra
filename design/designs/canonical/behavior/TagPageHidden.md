# TagPageHidden · `spec:design:behavior-tag-page-hidden`

WHEN tap Hide on a person in the reader's post menu opened from a tagged post's card -> the sheet closes AND the tag's page stands as it stood, every row in its place AND tagPage.snackbar reads @tobias is hidden — their posts stay out of your feed. with Undo on tagPage.snackbar.action AND NEVER a confirm step appears

ALWAYS a hidden actor's tagged things and their claims stay on the tag's page, now and at the next read, the hidden list being the feed's

ALWAYS nothing on the tag's page marks that an actor is hidden

WHEN tap Undo on tagPage.snackbar -> the person is unhidden AND the page stands as it stood AND the feed stands as it was before the hide

WHEN tap Undo on tagPage.snackbar GIVEN the unhide does not go through -> the person stays hidden AND the card the hide was made from says That didn't go through. with Retry until Retry or the next fresh load

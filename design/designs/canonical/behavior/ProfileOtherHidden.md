# ProfileOtherHidden · `spec:design:behavior-profile-other-hidden`

WHEN tap Hide on the person's profile menu -> the sheet closes AND the profile stays open as it stood AND profile.snackbar reads @ada is hidden — their posts stay out of your feed. with Undo AND NEVER a confirm step appears

ALWAYS nothing on the profile marks that the person is hidden, and every part of it still opens

WHEN tap Undo on profile.snackbar -> the person is unhidden AND the feed stands as it was before the hide

WHEN the reader returns to the feed GIVEN the hide stands -> the feed holds none of that person's rows

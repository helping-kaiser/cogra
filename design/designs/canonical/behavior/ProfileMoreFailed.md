# ProfileMoreFailed · `spec:design:behavior-profile-more-failed`

ALWAYS the failed page's row stands where the next page would have, under the rows already on screen

ALWAYS the row reads Couldn't load more, then Retry as an inline action

ALWAYS the row is quiet, at body-medium in the secondary colour, and never takes the error colour

ALWAYS the rows already on screen stay as they were, readable and live

ALWAYS the chronicle offers no Show more, no page numbers and no count of what is left

WHEN the retried page has not arrived 200ms after Retry is tapped -> Loading… stands in the row's place AND NEVER a spinner appears

WHEN the retried page arrives -> its acts join the chronicle below the rows already on screen AND the row goes

WHEN the retried page does not arrive -> the row stands where it stood

# ReplyEntry · `spec:design:behavior-reply-entry`

WHEN scroll settles at the thread's hard top GIVEN a qualifying clip exists -> the stage re-elects to the first qualifying clip in thread order

WHEN an overscroll bounce settles back at the thread's hard top GIVEN a qualifying clip exists -> the stage re-elects to the first qualifying clip in thread order

WHEN scroll settles anywhere below the thread's hard top GIVEN the incumbent still qualifies -> NEVER the stage re-elects upward

ALWAYS the thread's top-level comments stand newest first

ALWAYS the replies in a branch stand oldest first

WHEN the author's confirmed Remove on their own comment lands -> the comment's words and pictures give way to the mark Removed by its author in the comment's own place AND NEVER the comment leaves the thread

ALWAYS a removed comment's replies stay under it and readable

WHEN the sheet reopens after the reader's reply is signed -> the thread scrolls to the new reply's card AND NEVER the new reply's card stands below the sheet's foot

WHEN Add a comment or a comment's Reply is pressed GIVEN the reader is signed out -> the join prompt opens over the comments sheet AND NEVER the composer opens

WHEN Add a comment or a comment's Reply is pressed GIVEN the reader is an applicant -> the snackbar reads Comments open when you're in. AND NEVER the composer opens AND NEVER a comment stages

ALWAYS the comments sheet's foot stands for every reader, signed out and applicant included

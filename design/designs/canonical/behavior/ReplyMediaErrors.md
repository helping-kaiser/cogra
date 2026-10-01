# ReplyMediaErrors · `spec:design:behavior-reply-media-errors`

ALWAYS a comment's caps are four pictures at 10 MiB each, or one video at 50 MiB with a cover at 10 MiB

ALWAYS a file over its cap or in a format nothing here reads never joins the composer

ALWAYS a refusal stands on the composer's media row where the file was offered, never in a dialog or a snackbar

ALWAYS the caps are named only in a refusal, never announced ahead

ALWAYS a file is judged by its size and format before it is judged against the comment's body, one file and one line with the nearest reason

ALWAYS a refused file's line offers Remove it and never Retry

WHEN tap Remove it on a refused file -> the refusal leaves the composer

ALWAYS the add control still reads its count, as in + Add pictures · 4 of 4 GIVEN the tray is full

WHEN pick a file GIVEN the tray is full -> the pick is refused AND another refusal line joins the list

WHEN tap a picture's remove control GIVEN the tray is full -> the picture leaves the tray AND the tray takes picks again

WHEN tap Next GIVEN some files were refused -> only what was accepted goes with the words

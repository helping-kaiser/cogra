# ReplyKeyAbsent · `spec:design:behavior-reply-key-absent`

WHEN tap Reply on a comment GIVEN the key is elsewhere -> the notice A reply can't wait as pending — restore the key before you write. opens over the thread with Not now AND NEVER the composer opens

WHEN tap Add a comment GIVEN the key is elsewhere -> the notice A reply can't wait as pending — restore the key before you write. opens over the thread with Not now AND NEVER the composer opens

WHEN tap Not now -> the notice closes AND the thread stands as it was AND nothing is kept

WHEN tap the scrim -> the notice closes AND the thread stands as it was AND nothing is kept

ALWAYS the reply's door notice offers no way to keep a reply pending

ALWAYS the notice carries the no-backup sentence in place of its line and no restore button, with Not now alone GIVEN the reader has no backup

WHEN tap Restore the key -> the restore opens

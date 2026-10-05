# FeedNewerVersion · `spec:design:behavior-feed-newer-version`

WHEN the feed arrives after a cold app open GIVEN a release newer than the running one exists and this device has not announced it -> the snackbar reads A newer version of CoGra is out. with Update now AND this device marks that release announced

WHEN the app comes back to the foreground -> NEVER the newer-version snackbar appears

WHEN the feed arrives GIVEN this device already announced the newest release -> NEVER the newer-version snackbar appears

WHEN the newer-version snackbar times out or is dismissed -> nothing is lost AND NEVER the snackbar comes back for that release

ALWAYS each release is announced at most once on this device

WHEN press Update now GIVEN the app -> CoGra's Play Store listing opens

WHEN press Update now GIVEN the web -> the page reloads into the new version

WHEN press Update now -> NEVER a page of the code repository opens AND NEVER the notes page opens

ALWAYS Update now is one string for the app and the web, with no platform noun

ALWAYS no update is ever forced

ALWAYS the newer-version snackbar is a quiet message, one per release, never a confirmation of an act

ALWAYS a release's notes are reached from Settings' What's new, never from the snackbar

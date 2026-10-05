# WhatsNewBehind · `spec:design:behavior-whats-new-behind`

WHEN What's new opens GIVEN the version running here is behind the newest release -> one quiet line reads A newer version exists. ending in Update now, atop the list AND the newer release heads the list with newest in its dateline AND the running version keeps installed in its dateline

ALWAYS no dateline reads current

ALWAYS Update now is named Update to version and the newer version for a listener

ALWAYS the newer-version line and the newer release are the page's only changes, with no badge, no banner and no forced update

ALWAYS every release's dateline but the newest's and the installed one's carries no word

WHEN tap Update now in the app -> CoGra's Play Store listing opens AND NEVER the release's GitHub page opens

WHEN tap Update now on the web -> the page reloads into the new version AND NEVER the release's GitHub page opens

ALWAYS every release's card keeps its See it on GitHub, the newest release's included

WHEN tap See it on GitHub -> that release's public page opens outside the app, its full notes and its code AND NEVER the download opens

WHEN press the header back arrow -> settings returns at its About group

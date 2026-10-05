# YourKeyAbsent · `spec:design:behavior-your-key-absent`

WHEN tap the Your key row in settings GIVEN the key is elsewhere -> YourKeyAbsent opens AND NEVER an unlock or a code is asked for

ALWAYS the notice Your key isn't on this browser leads the page with There is no key on this browser to show.

ALWAYS no key card is drawn, neither empty nor with a placeholder

ALWAYS the paragraph says the key lives only on the device it was made on

ALWAYS the notice carries the no-backup sentence in place of its line and no Restore the key GIVEN the account has no backup

WHEN press Restore the key -> Restore opens

WHEN the key is restored from here -> Your key comes back as its key-present board

WHEN tap the notice's "?" -> HelpDialog opens with the Your key text

ALWAYS the header's arrow reads Back to settings and is the page's whole way out

WHEN press the header's back arrow -> Settings opens

# KeyElsewhereNoBackup · `spec:design:behavior-key-elsewhere-no-backup`

WHEN the app opens signed in on a device the key is not on GIVEN the account has no backup -> the feed opens with the no-backup card at its head

ALWAYS the card's title reads Your key isn't on this browser on the web and Your key isn't in this app in the app

ALWAYS the card's body reads This account has no backup, so the key can't be brought here yet. Make a recovery code on the device that holds it, then restore it here. Until then, anything you sign waits as pending.

ALWAYS the card carries no control and never offers Restore the key

ALWAYS the card wears the account-notice register

ALWAYS the feed reads as it always does beneath the card, its band, posts and nav answering as on KeyElsewhere

ALWAYS every key-absent notice, the composer's seal, the pad and both settings twins, carries the card's no-backup sentence in place of its restore line and draws no Restore the key GIVEN the account has no backup

ALWAYS the key-absent pad keeps Keep it pending, restore later GIVEN the account has no backup

ALWAYS a pick kept pending here can still be signed the day the key arrives

WHEN the feed loads next GIVEN a recovery code was made on the device that holds the key -> this card has become KeyElsewhere's card AND its restore works AND NEVER the card changes while the feed stands loaded

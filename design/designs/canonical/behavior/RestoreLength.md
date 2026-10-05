# RestoreLength · `spec:design:behavior-restore-length`

WHEN press Restore the key GIVEN the code, read the way every code input reads it, is not 26 characters -> the field's line reads A recovery code is 26 characters. AND the field takes the error state AND the field keeps what was typed

ALWAYS the wrong length is the one shape problem said apart, and every other refusal reads That code doesn't check out.

ALWAYS the length is counted after the reading takes the dashes and spaces out

ALWAYS the body reads Enter your recovery code to bring your signing key onto this browser. on the web and Enter your recovery code to bring your signing key into this app. in the app

ALWAYS the header's arrow reads Back and is a link to the reader's own home, never history

WHEN press the header's back arrow GIVEN a member -> KeyElsewhere opens

WHEN press the header's back arrow GIVEN an applicant -> ApplicantKeyElsewhere opens

WHEN tap Don't remember this account on this device -> the box flips AND nothing else changes

WHEN press Restore the key -> Restore the key refuses a second press until the restore answers AND NEVER Restore the key dims

WHEN the restore has not answered 200ms after the press -> Restore the key reads Restoring the key… AND NEVER a spinner appears

WHEN press Restore the key GIVEN the code is still the wrong length -> the line stands in place AND NEVER the screen changes

WHEN the code is 26 characters and does not open the backup -> the line reads That code doesn't check out. in the same place

WHEN press Restore the key GIVEN no answer reaches the device -> the field keeps what was typed AND the line That didn't send. Try again. stands above Restore the key AND Restore the key stays, the retry

WHEN the key is restored -> the line goes AND the reader returns where restore began AND the snackbar reads Your key is on this browser now. on the web and Your key is in this app now. in the app

WHEN the key is restored -> the key-absent state that sent the reader is gone AND the settings row that opened restore shows its key-present board AND the feed's key card leaves AND a draft that waited on the key goes on to be signed

WHEN the key is restored GIVEN picks kept pending wait -> KeptPicksReview opens under the same snackbar AND NEVER a kept pick signs on its own

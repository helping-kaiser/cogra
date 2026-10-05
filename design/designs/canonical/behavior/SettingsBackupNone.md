# SettingsBackupNone · `spec:design:behavior-settings-backup-none`

WHEN tap Recovery code GIVEN no recovery code has been made -> the make-a-code screen opens AND NEVER the replace screen opens

ALWAYS the make-a-code screen carries no code field, because no current code exists to prove

ALWAYS the make-a-code screen destroys nothing and mails nothing

WHEN press Create my recovery code in a browser -> the code screen opens with the first code AND back is swallowed there until the code is typed back

WHEN press Create my recovery code on Android GIVEN the phone has a screen lock -> the phone's own unlock is asked AND NEVER a code is made before it answers

WHEN the phone's unlock prompt is cancelled GIVEN Create my recovery code raised it -> the make-a-code screen stays as it was AND NEVER a code is made

WHEN press Create my recovery code on Android GIVEN the phone has no screen lock -> the no-screen-lock warning opens before anything else

WHEN the first code is typed back on the code screen -> the backup uploads AND settings returns with the snackbar Your key is backed up with the new code. AND the Recovery code row reads Last created with the day's date

WHEN the code screen is left before the code is typed back -> NEVER a backup is uploaded AND the Recovery code row still reads Not made yet

WHEN press the header back arrow -> settings returns AND NEVER a code is made

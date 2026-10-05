# SettingsBackupKeyAbsent · `spec:design:behavior-settings-backup-key-absent`

WHEN tap Recovery code GIVEN the key is not on this device -> the replace screen opens with the key-absent notice leading it AND NEVER an unlock or a current code is asked for

ALWAYS the key-absent notice stands above the heading, inset to the page's margins, in the waiting register and never the error one

ALWAYS the replace screen carries no code field and no Create a new recovery code GIVEN the key is not on this device

ALWAYS the replace screen still says when the current code was made, and that the current code keeps working GIVEN the key is not on this device

ALWAYS the notice's "?" is the screen's one "?" and is named Your key

WHEN tap the notice's "?" -> the Your key dialog opens over the screen

WHEN tap Restore the key -> the restore screen opens

ALWAYS the back arrow is the screen's one way out besides Restore the key

WHEN press the header back arrow -> settings returns AND nothing has changed

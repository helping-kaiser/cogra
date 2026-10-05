# ApplicantKeyElsewhere · `spec:design:behavior-applicant-key-elsewhere`

ALWAYS the key card stands GIVEN the applicant's attached key was made on another device and the application is not approved

ALWAYS the card's title reads Your key isn't on this browser GIVEN the web

ALWAYS the card's title reads Your key isn't in this app GIVEN the app

ALWAYS the card offers Restore the key and Make a new key GIVEN the account has a backup

ALWAYS the card offers Make a new key alone GIVEN the account has no backup

ALWAYS the card's body reads Your application's key was made on another device and has no backup, so it can't be brought here yet. Make a recovery code on that device and restore it here, or make a new key — until you're approved, a new one costs nothing. GIVEN the account has no backup

ALWAYS the card's body never asks for a recovery code GIVEN the account has no backup

WHEN tap Restore the key -> the restore opens

WHEN the restore brings the key here -> the key card leaves

WHEN tap Make a new key -> the key ceremony opens

WHEN tap Make a new key GIVEN a browser that cannot hold a key -> the ceremony says so before anything is minted

WHEN the ceremony reaches its end GIVEN it opened from this card -> the new key replaces the attached one AND the key on the other device stops counting for the application AND the key card leaves

WHEN back from the ceremony before its end -> the key card comes back AND the attached key is untouched

ALWAYS no surface offers Make a new key GIVEN the application is approved

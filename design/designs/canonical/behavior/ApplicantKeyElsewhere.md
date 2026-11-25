# ApplicantKeyElsewhere · `spec:design:behavior-applicant-key-elsewhere`

ALWAYS feed.keyCard stands GIVEN the applicant's attached key was made on another device and the application is not approved

ALWAYS feed.keyCard.title reads Your key isn't on this browser GIVEN the web

ALWAYS feed.keyCard.title reads Your key isn't in this app GIVEN the app

ALWAYS feed.keyCard offers feed.keyCard.restore and feed.keyCard.remake GIVEN the account has a backup

ALWAYS feed.keyCard offers feed.keyCard.remake alone GIVEN the account has no backup

ALWAYS feed.keyCard.body reads Your application's key was made on another device and has no backup, so it can't be brought here yet. Make a recovery code on that device and restore it here, or make a new key — until you're approved, a new one costs nothing. GIVEN the account has no backup

ALWAYS feed.keyCard.body never asks for a recovery code GIVEN the account has no backup

WHEN tap feed.keyCard.restore -> the restore opens

WHEN tap feed.keyCard.restore GIVEN a browser that cannot hold a key -> KeyCeremonyUnsupported opens in the restore's place AND NEVER the recovery code is typed

WHEN the restore brings the key here -> feed.keyCard leaves

WHEN tap feed.keyCard.remake -> the key ceremony opens

WHEN tap feed.keyCard.remake GIVEN a browser that cannot hold a key -> the ceremony says so before anything is minted

WHEN the ceremony reaches its end GIVEN it opened from this card -> the new key replaces the attached one AND the key on the other device stops counting for the application AND feed.keyCard leaves

WHEN back from the ceremony before its end -> feed.keyCard comes back AND the attached key is untouched

ALWAYS no surface offers Make a new key GIVEN the application is approved

# PadKeyAbsent · `spec:design:behavior-pad-key-absent`

WHEN tap a stance face GIVEN the signing key is not on this device -> the pad opens carrying the key notice AND NEVER anything is signed

WHEN press and hold a stance face GIVEN the signing key is not on this device -> the pad opens carrying the key notice, as a tap opens it AND NEVER anything is signed

ALWAYS the pad still shows the standing line, the pick's readout and the field GIVEN the signing key is not on this device

ALWAYS the notice Your key isn't on this browser stands where the landing line and the actions would, with Signing needs your key, which isn't in this browser — the write waits as pending. and Restore the key with your recovery code to finish. over Restore the key

ALWAYS no Set, no Cancel and no Walk it back stand on the pad GIVEN the signing key is not on this device

ALWAYS the notice wears the tertiary container, never the error colour

ALWAYS nothing is staged on the server and nothing is signed GIVEN the signing key is not on this device

WHEN drag on the pad field -> the pick moves AND its face and pair follow AND NEVER anything is signed

WHEN tap the notice's ? -> the Your key text opens

WHEN press Restore the key -> the key's restore opens

WHEN press Keep it pending, restore later -> the pad closes AND the pick waits on this device AND the target's anchor wears the kept pick's face with Waiting for your key under it AND NEVER anything is staged or signed

WHEN press outside the pad or press the system's Back -> the pad closes AND the pick is dropped, as a Cancel drops one AND NEVER the pick is kept

ALWAYS a pick is kept only by Keep it pending, restore later, never as the side effect of leaving

WHEN tap a kept pick's face GIVEN the key is still not on this device -> the pad opens again holding the kept pick

WHEN press Keep it pending, restore later GIVEN a pick is already kept on the same target -> the new pick replaces the kept one

ALWAYS a kept pick lives on this device only and survives a restart

ALWAYS several picks can wait at once, one per target

ALWAYS a remembered sign-out keeps every kept pick on the device

WHEN the reader signs out of an account set to forget this device GIVEN the key is backed up -> the kept picks are cleared with the draft

WHEN the reader signs out of an account set to forget this device GIVEN this device holds the only copy of the key -> the sign-out asks first, naming the key, the draft and the kept picks AND the kept picks stay sealed on this device unless the reader erases them

WHEN the session is ended from elsewhere -> every kept pick stays on this device, sealed and unusable until this device signs in again online with the account's current credentials AND NEVER a kept pick is destroyed

WHEN the key is restored GIVEN plain opinions are kept pending -> they sign together in one batch the reader reviews first AND NEVER a kept pick is signed silently

ALWAYS a kept vouch-back or approval never joins the kept picks' batch: it surfaces as its own card and signs through its own pad, its ceremony kept

ALWAYS the notice drops Restore the key and reads This account has no backup, so the key can't be brought here yet. Make a recovery code on the device that holds it, then restore it here. Until then, anything you sign waits as pending. GIVEN the account has no backup

# SettingsEmailPending · `spec:design:behavior-settings-email-pending`

ALWAYS the Email row reads the address the account still has, with Change pending under it, GIVEN an email change has a side still owed

ALWAYS the Email row never reads the new address GIVEN an email change has a side still owed

WHEN tap Email GIVEN an email change has a side still owed -> the change's confirmation opens, showing which side is still owed AND NEVER a second change request opens

WHEN the second side of the change lands -> the Email row reads the new address AND Change pending goes

WHEN the change is canceled -> the Email row reads the address alone AND Change pending goes

WHEN the change runs out before both sides land -> the Email row reads the address alone AND Change pending goes

WHEN tap Email GIVEN the change ran out before both sides landed -> the change request opens again AND NEVER the expired confirmation opens

ALWAYS every other row of settings stands and answers as it does with no change in flight

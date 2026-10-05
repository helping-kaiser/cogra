# ChangeEmailLinked · `spec:design:behavior-change-email-linked`

WHEN the new address's link is opened signed in GIVEN the code from the current address is still owed -> the landing reads New address confirmed AND says the code sent to the current address is the one side left AND its way on reads Enter the code AND NEVER the address moves

WHEN the new address's link is opened signed in GIVEN the code from the current address has landed -> the change applies AND the landing reads Email changed AND says the new address signs in and takes resets from now on AND its way on reads Back to settings

WHEN tap Enter the code -> the confirmation opens on the code's side AND the link's side reads confirmed

WHEN tap Back to settings -> settings opens AND the Email row reads the new address AND NEVER Change pending stands

WHEN the new address's link is opened GIVEN the change ran out before both sides landed -> the landing reads This link doesn't work anymore AND says the change ran out and the email is still the current address AND its way on reads Back to settings AND NEVER the address moves

WHEN the new address's link is opened GIVEN the new address was registered by another account meanwhile -> the landing reads That address is taken now over the address-taken line AND NEVER the address moves

ALWAYS the landing carries no back arrow

ALWAYS the landing's way on is a text button, and the landing offers no commitment

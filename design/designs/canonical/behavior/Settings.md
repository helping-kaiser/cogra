# Settings · `spec:design:behavior-settings`

ALWAYS settings is one scrolling page, its groups in the ruled order: Theme, Giving an opinion, Writing, Reading, People, Key backup, Sessions, Credentials, About, the sign-out group, the delete-account group

ALWAYS settings carries no bottom bar

ALWAYS the settings header and its back arrow stay pinned while the page scrolls

WHEN press the header back arrow -> the reader's own profile returns, where the gear was

ALWAYS an applicant reads the same settings page as a member, every row open to them

ALWAYS no row on settings carries a leading icon

ALWAYS a chevron on a row means the row opens another surface, and nothing else

WHEN tap Light, Dark or Auto -> the page repaints in the chosen theme AND the choice stays on this device AND NEVER the account carries it

ALWAYS the theme follows the device's own light-or-dark setting GIVEN Auto is chosen

ALWAYS one of The pad, Sliders and Typed values stands selected

WHEN tap The pad, Sliders or Typed values -> that input is how every opinion is taken, everywhere AND the other two stand unselected AND the choice stays on this device

WHEN tap Confirm multi-action submits -> the switch flips AND NEVER a dialog asks

ALWAYS the Default license row reads the account's default license in the license block's own words

ALWAYS the What your feed shows row reads the default every feed opens with, in the filter pill's own words

WHEN tap Show exact values GIVEN the switch is off -> the switch turns on AND the exact number pairs appear beside every face and glyph AND the choice stays on this device

WHEN tap Show exact values GIVEN the switch is on -> the switch turns off AND the faces and glyphs carry the pairs alone AND scores and ranks still read in numbers

ALWAYS the Hidden accounts row reads the bare count of hidden accounts GIVEN at least one account is hidden

ALWAYS the Hidden accounts row is inert and reads None GIVEN nobody is hidden

WHEN tap Hidden accounts GIVEN nobody is hidden -> NEVER a sheet opens

ALWAYS the Recovery code row reads Last created and the date the current code was made GIVEN a recovery code exists

ALWAYS the Recovery code row reads Not made yet GIVEN no recovery code has been made

ALWAYS the Key backup footnote says the key can't be brought back until a recovery code is made GIVEN no recovery code has been made

ALWAYS the Recovery code row and the Your key row read Not made yet and open the key ceremony GIVEN the reader is an applicant before the key ceremony

WHEN tap Your key on Android GIVEN the key is on this phone and the phone has a screen lock -> the phone's own unlock is asked before the key opens

WHEN the phone's unlock prompt is cancelled GIVEN Your key raised it -> settings stays as it was AND NEVER the key opens

WHEN tap Your key on Android GIVEN the phone has no screen lock -> the no-screen-lock warning opens before anything else

WHEN tap Your key in a browser GIVEN the browser still keeps the seed beside the key -> the key opens AND NEVER anything is asked first

WHEN tap Your key in a browser GIVEN the seed is sealed behind the backup -> the current recovery code is asked for first AND NEVER the key opens before it checks out

WHEN tap Your key GIVEN the key is elsewhere -> the key-absent screen opens AND NEVER an unlock is asked for

ALWAYS the row 3 kept picks waiting stands last in the Key backup group, reading 1 kept pick waiting in the singular, GIVEN picks kept with the key elsewhere wait unsigned, the key is here, and their review was left unsigned

ALWAYS no kept-picks row stands in the Key backup group GIVEN no kept pick waits for its review

WHEN the key leaves this device again GIVEN the kept-picks row stands -> the kept-picks row goes AND the waiting-for-key state owns the surface

ALWAYS the kept-picks row carries no status line, no badge and no colour, and nothing elsewhere reminds of it

WHEN tap the kept-picks row -> the kept picks' review opens with every kept pick still in it

ALWAYS the current session's row reads This browser on the web and This phone in the app, and carries no Revoke

ALWAYS every other session's row reads its device and Last used with the session's age, with Revoke on its trailing edge

ALWAYS a session's row is inert apart from its Revoke

WHEN tap Revoke -> that session's row goes AND the snackbar reads Signed out of, then the session's device, as Signed out of Pixel 8. AND focus moves to the next row, else the previous AND NEVER a dialog asks

WHEN the revoke has not answered 200ms after the press -> Revoke reads Revoking… in its own place AND NEVER a spinner appears

WHEN tap Revoke GIVEN the reader is offline -> the network error answers AND the session's row stays

WHEN tap Sign out everywhere else -> every session row but this one goes AND the snackbar reads Signed out everywhere else. AND this device stays signed in AND NEVER a dialog asks

WHEN tap Sign out everywhere else GIVEN the reader is offline -> the network error answers AND every session row stays

ALWAYS the Password row reads Changed and the age of the last change

ALWAYS the Handle row reads the reader's handle

ALWAYS the Email row reads the address the account has

ALWAYS the Email row reads Change pending under the address the account still has GIVEN an email change has a side still owed

WHEN tap Email GIVEN no email change is in flight -> the change request opens

WHEN tap Email GIVEN the reader is an applicant whose address is not verified yet -> the applicant's own address change opens AND NEVER the member's two-sided change request opens

ALWAYS the Email row reads the address alone, with no Change pending, GIVEN an email change ran out before both sides landed

WHEN tap Email GIVEN an email change ran out before both sides landed -> the change request opens again

WHEN tap Email GIVEN an email change has a side still owed -> the change's confirmation opens on the side still owed AND NEVER a second request opens

ALWAYS the What's new row reads the version running here

WHEN tap Watch the intro again -> the intro opens from its first card

WHEN tap Report a problem GIVEN words were kept from a visit left with Back -> the report opens with those words in its field

WHEN tap Report a problem GIVEN no words were kept -> the report opens with its field empty

WHEN tap Contact -> the reader's own mail opens addressed to the contact address AND NEVER the report opens

WHEN tap Privacy or Terms -> the written document opens

ALWAYS the don't-remember switch's line reads Your key, your draft and any kept picks are cleared from this browser when you sign out. on the web

WHEN tap Don't remember this account on this device -> the switch flips AND NEVER a dialog asks AND NEVER the reader is signed out

ALWAYS the login form carries the same Don't remember this account on this device

WHEN tap Sign out GIVEN the don't-remember switch is off -> the session ends AND the sign-in screen opens with the account still offered AND the key stays on this device AND NEVER a dialog asks

WHEN tap Sign out GIVEN the don't-remember switch is on and this device does not hold the only copy of an unbacked key -> the session ends AND the key, the draft and any picks kept pending are cleared from this device AND the sign-in screen opens AND NEVER a dialog asks

WHEN tap Sign out GIVEN the don't-remember switch is on and this device holds the only copy of an unbacked key -> the dialog Sign out without a backup? opens over settings AND NEVER the session ends before an answer AND NEVER anything is cleared before an answer

WHEN the sign-out has not answered 200ms after the press -> Sign out reads Signing out… in its own place AND NEVER a spinner appears

ALWAYS the deletion group's footnote reads Nothing is deleted here. The next screen says what goes and what stays, and the deletion is confirmed by a link we email you. GIVEN the reader is a member and no deletion is in its grace

ALWAYS the deletion group's footnote reads Nothing is deleted here. The next screen says what goes and what stays. GIVEN the reader is an applicant

WHEN tap Delete account GIVEN no deletion is in its grace -> the deletion's request screen opens AND NEVER anything is deleted from the row

ALWAYS Delete account wears the locked look, visibly inactive at the disabled opacity and still tappable GIVEN the reader is an applicant whose application is approved and whose registration has not landed

WHEN tap Delete account GIVEN the reader is an applicant whose application is approved and whose registration has not landed -> the snackbar reads You can delete your account once you're in. AND NEVER the deletion's request screen opens AND NEVER anything is deleted

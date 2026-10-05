# ChangePassword · `spec:design:behavior-change-password`

ALWAYS the screen says before the act that changing the password signs out every other device and keeps this one signed in

ALWAYS the screen asks for the current password and one new password, and never for the new password twice

ALWAYS the form opens at rest, nothing marked

WHEN typing in either field GIVEN the field is not marked -> NEVER the field is marked before the next press of Change password

WHEN typing in a field GIVEN the field carries an error -> the field re-checks as it is typed

WHEN tap reveal password on a field -> that field's password shows

WHEN press Change password GIVEN the current password is right and the new one is accepted -> settings returns AND the snackbar reads Password changed — other devices are signed out. AND every other session ends AND this device stays signed in AND the Password row reads Changed with the new age

WHEN every other session ends GIVEN another device is set to forget the account and holds an unbacked key -> that key stays on that device, sealed AND NEVER it is erased

WHEN press Change password GIVEN the current password is wrong -> the Current password field reads That password isn't right. AND NEVER the password changes

WHEN press Change password GIVEN the new password is longer than 128 characters -> the New password field reads A password is at most 128 characters. AND NEVER the password changes

WHEN press Change password GIVEN the new password is shorter than 12 characters -> the New password field reads A password is at least 12 characters. AND NEVER the password changes

WHEN press Change password GIVEN the new password has turned up in a data breach -> the New password field reads That password has turned up in a data breach — pick another one. AND NEVER the password changes

WHEN the change has not answered 200ms after the press -> Change password reads Changing password… in its own place AND NEVER a spinner appears

WHEN press Change password GIVEN no answer reaches the device -> the fields keep what was typed AND the line That didn't send. Try again. stands above Change password AND Change password stays, the retry AND NEVER the password changes

WHEN press the header back arrow -> settings returns AND NEVER the password changes

ALWAYS the page scrolls when its content outgrows the screen at any width or text size, so its action stays within reach

ALWAYS Change password stands disabled with Waiting for both passwords right above it GIVEN either password field is empty

WHEN both password fields hold a character -> Change password wakes AND the line Waiting for both passwords goes

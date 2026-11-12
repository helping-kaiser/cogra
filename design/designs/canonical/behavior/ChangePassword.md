# ChangePassword · `spec:design:behavior-change-password`

ALWAYS the screen says before the act that changing the password signs out every other device and keeps this one signed in

ALWAYS the screen asks for the current password, then the new password twice: New password and under it Repeat password, masked alike, Repeat password with no hint

ALWAYS the form opens at rest, nothing marked

WHEN typing in any field GIVEN the field is not marked -> NEVER the field is marked before the next press of Change password

WHEN typing in New password GIVEN the field reads A password is at most 128 characters. or A password is at least 12 characters. -> the line re-checks as the reader types and goes once the password is 12 to 128 characters

WHEN typing in Current password GIVEN the field reads That password isn't right. -> the line stands until the next press of Change password

WHEN typing in New password GIVEN the field reads That password has turned up in a data breach — pick another one. -> the line stands until the next press of Change password

WHEN tap reveal password on a field -> that field's password shows

WHEN press Change password GIVEN the current password is right and the new one is accepted -> settings returns AND the snackbar reads Password changed — other devices are signed out. AND every other session ends AND this device stays signed in AND the Password row reads Changed with the new age

WHEN every other session ends GIVEN another device is set to forget the account and holds an unbacked key -> that key stays on that device, sealed AND NEVER it is erased

WHEN press Change password GIVEN the current password is wrong -> the Current password field reads That password isn't right. AND NEVER the password changes

WHEN press Change password GIVEN the new password is longer than 128 characters -> the New password field reads A password is at most 128 characters. AND NEVER the password changes

WHEN press Change password GIVEN the new password is shorter than 12 characters -> the New password field reads A password is at least 12 characters. AND NEVER the password changes

WHEN press Change password GIVEN the new password has turned up in a data breach -> the New password field reads That password has turned up in a data breach — pick another one. AND NEVER the password changes

WHEN press Change password GIVEN Repeat password differs from New password -> the Repeat password field reads The two passwords don't match. AND NEVER the password changes

WHEN typing in New password or Repeat password GIVEN Repeat password reads The two passwords don't match. -> the line re-checks as the reader types and goes once the two passwords match

WHEN the change has not answered 200ms after the press -> Change password reads Changing password… in its own place AND NEVER a spinner appears

WHEN press Change password GIVEN no answer reaches the device -> the fields keep what was typed AND the line That didn't send. Try again. stands above Change password AND Change password stays, the retry AND NEVER the password changes

WHEN press Change password GIVEN the account's re-auth budget is spent -> the line Too many tries. Wait a little, then try again. stands above Change password AND Change password stays AND NEVER the password changes

WHEN press the header back arrow GIVEN Change password has not been pressed -> settings returns AND NEVER the password changes

ALWAYS the header's arrow is named Close from the press of Change password until its answer comes

WHEN press Close GIVEN Change password was pressed -> settings returns AND the change goes on AND NEVER the change is canceled

WHEN the change fails GIVEN the form was closed after the press -> the Password row in settings reads That didn't go through. AND NEVER Retry stands on the row

WHEN tap the Password row GIVEN it reads That didn't go through. -> the form opens, the passwords typed again AND the line leaves the row AND the form stands at rest AND a refusal about one field, as a wrong current password, stands beside that field in the form's own field-error line

ALWAYS the page scrolls when its content outgrows the screen at any width or text size, so its action stays within reach

ALWAYS Change password stands disabled with no line above it and its spoken description reads Waiting for both passwords GIVEN any password field is empty

WHEN all three password fields hold a character -> Change password wakes AND its spoken description Waiting for both passwords goes

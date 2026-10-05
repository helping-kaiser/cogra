# ChangeHandle · `spec:design:behavior-change-handle`

ALWAYS the screen says before the act that everything published stays the reader's, and after the commitment that links to the old handle stop working and anyone can claim it

ALWAYS the handle's rules stand under the field while it is typed: 3 to 30 characters, letters, numbers and underscore, always lowercase

ALWAYS the screen asks for no password

ALWAYS the form opens at rest, nothing marked

WHEN typing in New handle GIVEN the field is not marked -> NEVER the field is marked before the next press of Change handle

WHEN press Change handle -> the dialog Change your handle to, then the new handle, opens over the form AND NEVER the handle changes before the dialog is answered

ALWAYS a handle change moves nothing the reader has signed

WHEN press the header back arrow -> settings returns AND NEVER the handle changes

# ChangeHandle · `spec:design:behavior-change-handle`

ALWAYS the screen says before the act that everything published stays the reader's, and after the commitment that links to the old handle stop working and anyone can claim it

ALWAYS the handle's rules stand under the field while it is typed: 3 to 30 characters, letters, numbers and underscore, always lowercase

ALWAYS the screen asks for no password

ALWAYS the form opens at rest, nothing marked

WHEN typing in New handle GIVEN the field is not marked -> NEVER the field is marked before the next press of Change handle

WHEN press Change handle GIVEN the handle is free and well-formed -> settings returns AND the snackbar answers AND the Handle row reads the new handle AND the old handle is free for anyone at once AND links to the old handle stop resolving to the reader

ALWAYS a handle change moves nothing the reader has signed

WHEN press Change handle GIVEN the handle is taken -> the field reads That handle is taken. AND NEVER the handle changes

WHEN the change has not answered 200ms after the press -> Change handle reads Changing handle… in its own place AND NEVER a spinner appears

WHEN press Change handle GIVEN the reader is offline -> the network error answers AND NEVER the handle changes

WHEN press the header back arrow -> settings returns AND NEVER the handle changes

ALWAYS the page scrolls when its content outgrows the screen at any width or text size, so its action stays within reach

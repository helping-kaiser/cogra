# ChangeHandle · `spec:design:behavior-change-handle`

ALWAYS the screen says before the act that everything published stays the reader's, and after the commitment that links to the old handle stop working and anyone can claim it

ALWAYS the handle's rules stand under the field while it is typed: 3 to 30 characters, letters, numbers and underscore, always lowercase

ALWAYS the screen asks for no password

ALWAYS the form opens at rest, nothing marked

WHEN typing in New handle GIVEN the field is not marked -> NEVER the field is marked before the next press of Change handle

WHEN press Change handle GIVEN the new handle keeps the field's rules -> the dialog Change your handle to, then the new handle, opens over the form AND NEVER the handle changes before the dialog is answered

WHEN press Change handle GIVEN the new handle breaks the field's rules -> the New handle field reads A handle is 3–30 characters: a–z, 0–9, _. AND NEVER the dialog opens AND NEVER the handle changes

WHEN typing in New handle GIVEN the field reads its format line -> the line re-checks as the reader types and goes once the handle keeps the rules

ALWAYS Change handle stands disabled with Waiting for a new handle right above it GIVEN New handle is empty

WHEN the first character is typed in New handle -> Change handle wakes AND the line Waiting for a new handle goes

ALWAYS a handle change moves nothing the reader has signed

WHEN press the header back arrow -> settings returns AND NEVER the handle changes

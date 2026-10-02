# ComposeBodyDiscard · `spec:design:behavior-compose-body-discard`

WHEN tap Add pictures instead GIVEN the body holds words -> the dialog Discard the words? opens over the words stage with The rest of the draft stays.

WHEN tap Write words instead GIVEN the body holds pictures -> the dialog Discard the pictures? opens over the pick stage with The rest of the draft stays.

ALWAYS Keep them is the filled answer and Discard the quiet one

WHEN tap Keep them -> the dialog closes onto the stage as it was AND NEVER the body changes

WHEN tap Discard GIVEN the dialog was raised by Add pictures instead -> the words are discarded AND the pick step opens AND the rest of the draft stays

WHEN tap Discard GIVEN the dialog was raised by Write words instead -> the pictures or the clip are discarded AND the words stage opens empty AND the rest of the draft stays

WHEN press outside the dialog -> the dialog closes onto the stage as it was AND NEVER the body changes

WHEN make the platform back gesture -> the dialog closes onto the stage as it was AND NEVER the body changes

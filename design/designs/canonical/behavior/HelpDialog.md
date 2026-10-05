# HelpDialog · `spec:design:behavior-help-dialog`

WHEN tap a screen's "?" -> the dialog it names opens over the screen AND the screen stays visible and inert beneath the scrim

ALWAYS a "?" is named by the subject of the dialog it opens

ALWAYS the dialog holds a title naming the thing asked about, at most two short paragraphs and Close

ALWAYS the dialog offers no link and no second action

ALWAYS the dialog's paragraphs are the copy-voice text for its subject, in the platform noun of the client it opens on

WHEN the dialog opens -> focus moves to its title AND focus stays inside the dialog until it closes

WHEN tap Close -> the dialog closes onto the screen that asked, as it was AND focus returns to the "?" that opened it

WHEN tap the scrim -> the dialog closes onto the screen that asked, as it was AND focus returns to the "?" that opened it

WHEN press system Back GIVEN the dialog is open -> the dialog closes onto the screen that asked, as it was AND NEVER the screen beneath navigates back

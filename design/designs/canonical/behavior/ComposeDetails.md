# ComposeDetails · `spec:design:behavior-compose-details`

WHEN media attaches GIVEN it matches media in a published post of the author -> the media row shows the already-published marker

WHEN media attaches GIVEN it matches media only in the author's drafts -> NEVER the media row shows the already-published marker

WHEN media attaches GIVEN it matches media only in other people's posts -> NEVER the media row shows the already-published marker

WHEN media attaches GIVEN it matches media in a published post of the author -> NEVER a dialog opens AND NEVER a confirm step appears

WHEN tap the already-published marker -> the earliest matching post opens

ALWAYS the already-published marker never blocks composing or publishing

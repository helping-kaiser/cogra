# ComposeDetailsReused · `spec:design:behavior-compose-details-reused`

ALWAYS composeDetails.published, Already in your post from 12 September., stands under composeDetails.mediaRow in the honesty-marker ink GIVEN media on the stage matches media in a published post of the author

ALWAYS the line's date is the matched post's publication date, day and month, with the year appended only when the post's year differs from the current one

ALWAYS the line names the earliest matching post, and a later post never repoints it, GIVEN several of the author's published posts match

ALWAYS the line is a door in the tappable-marker form, underlined in the quiet ink, and its accessible name is its own words

WHEN tap composeDetails.published -> the post it names opens AND NEVER a dialog opens AND NEVER a confirm step appears

WHEN media attaches GIVEN it matches media only in the author's drafts or only in other people's posts -> NEVER the line stands

ALWAYS the line never blocks composing or publishing, and composeDetails.next stays as live as on the stage at rest

ALWAYS the stage draws everything else exactly as the details stage at rest does

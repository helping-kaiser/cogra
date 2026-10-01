# ComposeDetails · `spec:design:behavior-compose-details`

WHEN media attaches GIVEN it matches media in a published post of the author -> composeDetails.mediaRow shows the already-published marker

WHEN media attaches GIVEN it matches media only in the author's drafts -> NEVER composeDetails.mediaRow shows the already-published marker

WHEN media attaches GIVEN it matches media only in other people's posts -> NEVER composeDetails.mediaRow shows the already-published marker

WHEN media attaches GIVEN it matches media in a published post of the author -> NEVER a dialog opens AND NEVER a confirm step appears

WHEN tap the already-published marker -> the earliest matching post opens

ALWAYS the already-published marker never blocks composing or publishing

ALWAYS the stage never stands on an empty body

ALWAYS composeDetails.mediaRow carries no crop or edit shortcut of its own

WHEN tap composeDetails.mediaRow -> the Show all sheet opens over the stage

ALWAYS composeDetails.describeRow.reason reads Read aloud to people who can't see it.

ALWAYS no count stands under composeDetails.title GIVEN more than 20 of its 100 characters remain

WHEN typing leaves 20 or fewer of composeDetails.title's 100 characters -> the remaining count stands at the end of its supporting row reading N left AND NEVER the count takes the error colour

ALWAYS no count stands under composeDetails.description GIVEN more than 50 of its 500 characters remain

WHEN typing leaves 50 or fewer of composeDetails.description's 500 characters -> the remaining count stands at the end of its supporting row reading N left AND NEVER the count takes the error colour

WHEN typing passes composeDetails.title's 100 characters -> the count reads N over in the error colour AND the line A title is at most 100 characters. takes the hint's place AND composeDetails.next goes inert

WHEN typing passes composeDetails.description's 500 characters -> the count reads N over in the error colour AND the line A description is at most 500 characters. takes the hint's place AND composeDetails.next goes inert

WHEN typing brings an over-long field back within its cap GIVEN no other field is over -> its refusal clears at once AND composeDetails.next answers again

ALWAYS the counts count Unicode scalar values, never UTF-16 code units

WHEN press composeDetails.next GIVEN composeDetails.title and composeDetails.description are empty -> NEVER composeDetails.next refuses

WHEN tap composeDetails.tags.tag.remove -> the tag leaves the post's staged tags on the spot AND NEVER a dialog asks

WHEN tap composeDetails.tags.tag -> the tag's pair opens in a sheet over the stage

WHEN tap composeDetails.references.stagedReference.remove -> the citation leaves the post's citations on the spot AND NEVER a dialog asks

WHEN tap composeDetails.references.stagedReference -> the citation's pair opens in a sheet over the stage

WHEN tap composeDetails.references.add GIVEN a citation is staged -> the citation picker opens AND the staged citation stays

ALWAYS a citation staged here starts at the pair +0.10 / +0.10

ALWAYS a tag staged here starts at relevance +0.1 and confidence 1

WHEN press composeDetails.header.back -> the crop comes back, one stage behind

WHEN press composeDetails.header.leave -> the whole flow is left AND the draft is kept AND NEVER a dialog asks

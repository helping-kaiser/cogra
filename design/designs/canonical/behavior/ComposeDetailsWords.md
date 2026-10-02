# ComposeDetailsWords · `spec:design:behavior-compose-details-words`

ALWAYS the stage carries no media row, no describe row and no description field

ALWAYS the stage's title, tags, references and Next are the picture path's details stage's own

ALWAYS no count stands under the title GIVEN more than 20 of its 100 characters remain

WHEN typing leaves 20 or fewer of the title's 100 characters -> the remaining count stands at the end of its supporting row reading N left AND NEVER the count takes the error colour

WHEN typing passes the title's 100 characters -> the count reads N over in the error colour AND the line A title is at most 100 characters. takes the hint's place AND Next goes inert

WHEN press Next GIVEN the title is empty -> NEVER Next refuses

WHEN press Next -> the seal opens AND NEVER an upload holds the step

WHEN tap a staged tag's remove control -> the tag leaves the post's staged tags on the spot AND NEVER a dialog asks

WHEN tap a staged tag -> the tag's pair opens in a sheet over the stage

WHEN tap the staged reference's remove control -> the citation leaves the post's citations on the spot AND NEVER a dialog asks

WHEN tap the staged reference's row -> the citation's pair opens in a sheet over the stage

WHEN tap + Cite something GIVEN a citation is staged -> the citation picker opens AND the staged citation stays

WHEN press the header back arrow -> the words stage comes back, one stage behind

WHEN press the header X -> the whole flow is left AND the draft is kept AND NEVER a dialog asks

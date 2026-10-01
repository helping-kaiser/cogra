# ComposeCited · `spec:design:behavior-compose-cited`

WHEN the details stage opens GIVEN Cite in a new post or Mention in a new post began the draft -> the reference brought along stands staged in the References block AND nothing else is written

ALWAYS a cited post and a mentioned person stand in the References block as one row shape

WHEN tap the staged reference's remove control -> the citation leaves the post on the spot AND NEVER a dialog asks

WHEN tap the staged reference's row -> the citation's pair opens in a sheet over the stage

WHEN tap + Cite something GIVEN a citation is staged -> the citation picker opens AND the staged citation stays

ALWAYS no count stands under the title GIVEN more than 20 of its 100 characters remain

ALWAYS no count stands under the description GIVEN more than 50 of its 500 characters remain

WHEN typing passes the title's 100 characters -> the count reads N over in the error colour AND the line A title is at most 100 characters. takes the hint's place AND Next goes inert

WHEN typing passes the description's 500 characters -> the count reads N over in the error colour AND the line A description is at most 500 characters. takes the hint's place AND Next goes inert

WHEN press Next GIVEN the title and the description are empty -> NEVER Next refuses

WHEN press the header back arrow -> the words stage comes back AND the reference still rides the draft

WHEN press the header X -> the whole flow is left AND the draft is kept AND NEVER a dialog asks

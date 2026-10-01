# ComposeDetailsCaps · `spec:design:behavior-compose-details-caps`

ALWAYS each count is computed from the text in its field, in Unicode scalar values

WHEN typing leaves 20 or fewer of the title's 100 characters -> the title's count reads N left at the end of its supporting row AND NEVER the count takes the error colour

WHEN typing gives the title back more than 20 of its 100 characters -> the title's count goes away

WHEN typing passes the description's 500 characters -> the description's count reads N over in the error colour AND the line A description is at most 500 characters. takes its hint's place AND Next goes inert

WHEN typing passes the title's 100 characters -> the title's count reads N over in the error colour AND the line A title is at most 100 characters. takes its hint's place AND Next goes inert

WHEN typing brings an over-long field back within its cap -> that field's refusal clears at once

ALWAYS Next stays visible and inert GIVEN a field is over its cap

WHEN press Next GIVEN a field is over its cap -> NEVER the step advances

WHEN press the header X GIVEN a field is over its cap -> the whole flow is left AND the draft is kept with its over-long words AND NEVER a dialog asks

WHEN press the header back arrow -> the crop comes back, one stage behind

# ComposeWordsCaps · `spec:design:behavior-compose-words-caps`

ALWAYS the body's count counts the whole body in Unicode scalar values, never only the tail the box shows

ALWAYS the body wears the error outline GIVEN the body is over 5,000 characters

ALWAYS the line A post's words are at most 5,000 characters. stands at the start of the body's supporting row and the count reading N over at its end GIVEN the body is over 5,000 characters

ALWAYS Next stays visible and inert GIVEN the body is over 5,000 characters

WHEN press Next GIVEN the body is over 5,000 characters -> NEVER the step advances

WHEN cutting brings the body within 5,000 characters -> the refusal and the error outline clear at once AND the count stays reading N left while 500 or fewer characters remain AND Next answers again

WHEN press the header X -> the whole flow is left AND the draft is kept with its over-long words AND NEVER a dialog asks

WHEN press the header back arrow -> the pick step comes back, one stage behind

WHEN tap Add pictures instead GIVEN the body holds words -> an ask to discard the body opens over the stage AND NEVER the body switches before the ask is answered

WHEN tap Add pictures instead GIVEN the body is empty -> the pick step opens AND NEVER an ask opens

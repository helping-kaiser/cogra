# ComposeDraft · `spec:design:behavior-compose-draft`

WHEN New post is pressed GIVEN a draft is kept on this device -> the draft card leads the screen above the pick step AND the pick region stands dimmed beneath it

ALWAYS the draft card wears the brand ring

ALWAYS the dimmed pick region is out of reach to touch, keyboard and assistive technology alike

ALWAYS one draft is kept per target, on this device only

WHEN tap anywhere on the dimmed pictures -> the ask Discard your draft? opens over the screen

WHEN focus reaches the dimmed pictures -> one control named Answer your draft before starting a new post stands in their place

WHEN press Continue -> the draft resumes where it was left

WHEN press Discard -> the draft is discarded AND a fresh pick begins with the pictures in reach

WHEN press the header back arrow -> compose is left AND the draft stays AND NEVER a dialog asks

WHEN press the header X -> compose is left AND the draft stays AND NEVER a dialog asks

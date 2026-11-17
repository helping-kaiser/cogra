# ComposeDraft · `spec:design:behavior-compose-draft`

WHEN New post is pressed GIVEN a draft is kept on this device -> the draft card leads the screen above the pick step AND the pick region stands dimmed beneath it

ALWAYS the draft card wears the brand ring

ALWAYS the dimmed pick region is out of reach to touch, keyboard and assistive technology alike

ALWAYS one draft is kept per target, on this device only

ALWAYS a draft is kept only once the composer holds something of the author's own, never for a fresh pick or for only what Cite in a new post, Mention in a new post or a tag card's compose glyph opened it with

WHEN New post is pressed GIVEN the last composer was left holding nothing of the author's own and no draft was kept before it -> the pick step opens fresh AND NEVER the draft card stands

WHEN tap anywhere on the dimmed pictures -> the ask Discard your draft? opens over the screen

WHEN focus reaches the dimmed pictures -> one control named Answer your draft before starting a new post stands in their place

WHEN press Continue -> the draft resumes where it was left

WHEN press Discard -> the draft is discarded AND a fresh pick begins with the pictures in reach

WHEN press the header back arrow -> compose is left for where the composer was opened from AND the draft stays AND NEVER a dialog asks

WHEN press the header X -> compose is left for where the composer was opened from AND the draft stays AND NEVER a dialog asks

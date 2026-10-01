# ReplyEntry · `spec:design:behavior-reply-entry`

WHEN scroll settles at the thread's hard top GIVEN a qualifying clip exists -> the stage re-elects to the first qualifying clip in thread order

WHEN an overscroll bounce settles back at the thread's hard top GIVEN a qualifying clip exists -> the stage re-elects to the first qualifying clip in thread order

WHEN scroll settles anywhere below the thread's hard top GIVEN the incumbent still qualifies -> NEVER the stage re-elects upward

ALWAYS the thread's top-level comments stand newest first

ALWAYS the replies in a branch stand oldest first

WHEN the author's confirmed Remove on their own comment lands -> the comment's words and pictures give way to the mark Removed by its author in the comment's own place AND NEVER the comment leaves the thread

ALWAYS a removed comment's replies stay under it and readable

WHEN a deep link opens the thread on a comment -> the comments sheet opens with that comment scrolled to the sheet's top AND the comment's branch stands expanded AND the comment wears a tonal highlight AND the highlight has faded WITHIN 1s

WHEN a deep link opens the thread on a comment GIVEN reduced motion is set -> the comment's tonal highlight clears WITHIN 1s AND NEVER the highlight fades

ALWAYS a deep-linked comment's highlight is a step up the surface ladder and never a hue

WHEN back returns from a screen a control in the sheet opened -> the comments sheet stands open over the post at the offset it was left AND every branch the reader expanded stands expanded

WHEN the post wizard that Cite in a new post opened closes with its X -> the comments sheet stands open over the post as it was left
# ReplyEntry · `spec:design:behavior-reply-entry`

WHEN scroll settles at the thread's hard top GIVEN a qualifying clip exists -> the stage re-elects to the first qualifying clip in thread order

WHEN an overscroll bounce settles back at the thread's hard top GIVEN a qualifying clip exists -> the stage re-elects to the first qualifying clip in thread order

WHEN scroll settles anywhere below the thread's hard top GIVEN the incumbent still qualifies -> NEVER the stage re-elects upward

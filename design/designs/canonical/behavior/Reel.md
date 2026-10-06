# Reel · `spec:design:behavior-reel`

ALWAYS the stream carries only clips taller than they are wide, from the reader's own ranked feed and by no second ranking

ALWAYS no header labels the stream

ALWAYS the clip runs at its own full frame, edge to edge

ALWAYS the stream wears the sound control and a thin seek line, and never play and pause or the full transport

ALWAYS the seek line rides directly above the bottom bar, never on the screen's bottom edge

ALWAYS the bottom bar stays on the stream

ALWAYS the rail reads, top to bottom, the author, the opinion, the comments, the share and the score

ALWAYS the score on the rail is the same number the card wore

WHEN swipe the clip -> the next clip in the same ranked feed takes the screen

WHEN drag the seek line -> the clip moves under the finger

WHEN tap the sound control -> sound turns on or off as the one sticky decision every video shares

WHEN tap the score -> the clip squishes to the top of the screen still playing AND the post rises beneath it AND NEVER a new page opens in its place

WHEN tap the opinion face -> the same pad opens over the clip AND the clip pauses

WHEN the pad over the clip closes GIVEN the clip was playing when the pad opened -> the stream resumes the same clip at its position

WHEN tap the comment count -> the same comments sheet opens over the clip AND the clip stops

WHEN tap the opinion face GIVEN the reader is signed out -> the join prompt opens over the paused clip

WHEN press the way back GIVEN the stream was opened from the feed it narrowed -> the stream closes on the feed it narrowed

WHEN press the way back GIVEN the stream was opened from anywhere else -> the stream closes onto where it was opened, the state the reader left exactly

ALWAYS the way back reads Back to feed from the feed it narrowed, Back to the post from a post's pinned clip, Back to the profile from another's posts, Back to your profile from the reader's own and Back to History from History

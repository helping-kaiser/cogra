# Reel · `spec:design:behavior-reel`

ALWAYS the stream carries only clips taller than they are wide, from the list it was opened from narrowed to them in that list's order — the feed it narrowed, History's rows or the profile's posts — and by no ranking of its own

ALWAYS no header labels the stream

ALWAYS the clip runs at its own full frame, edge to edge below the system status bar

ALWAYS the system status bar stays the system's, its strip never painted black or any colour by the stream, its washes included

ALWAYS the stream wears the sound control and a thin seek line, and never a pause or the full transport

ALWAYS the seek line rides directly above the bottom bar, never on the screen's bottom edge

ALWAYS the seek line's ink stays a 3px line and its touch target is 48dp, rising from the track, with the caption standing clear above that target

ALWAYS the bottom bar stays on the stream

ALWAYS the rail reads, top to bottom, the author, the opinion, the comments, the share and the score

ALWAYS the score on the rail is the same figure the card wore, and from a feed the one the reader's own last feed fetch computed

ALWAYS the rail's score is the door to the post, whichever face it wears

ALWAYS the rail's score stands as the bare graph glyph with Still settling under it, never a 0, a dash or a placeholder, GIVEN the clip is still settling, under Ranked and Newest alike

ALWAYS the rail's score reads a dash, never the figure it wore before, GIVEN the trace's fetch found no paths for the post since the reader's last feed fetch

WHEN the feed is fetched again GIVEN the rail's score reads a dash -> the rail's score reads what that fetch computed

ALWAYS the stream pages vertically, a swipe up bringing the next clip and a swipe down the one before, from the tapped clip both ways through the list's clips

WHEN swipe up on the clip -> the next clip in the same list takes the screen

WHEN swipe down on the clip GIVEN a clip stands before it in the list -> the clip before it takes the screen AND NEVER the stream closes

WHEN swipe down on the clip GIVEN it is the list's first -> the clip stays AND NEVER the stream closes AND NEVER it wraps to the last

ALWAYS the stream never moves on to the next clip by itself

ALWAYS the caption's head carries the line That's the last clip here. on the stream's plate GIVEN the list holds no clip after the one on screen

WHEN swipe up on the clip GIVEN it is the list's last -> the clip stays AND NEVER the stream wraps to the first

WHEN swipe up on the clip GIVEN the next clips have not loaded and their load fails -> the clip on screen stays and plays on AND the caption's head carries Couldn't load more with Retry on the stream's plate AND NEVER the stream closes AND NEVER an empty frame takes the screen

WHEN tap Retry on the stream's Couldn't load more -> the next clips are asked for again AND the line goes once they come

WHEN the stream opens GIVEN the device suppresses autoplay -> the tapped clip stands paused on its cover AND the card's play disc stands in the sound control's corner AND NEVER the clip starts on its own

WHEN swipe to another clip GIVEN the device suppresses autoplay -> that clip stands paused on its cover with the play disc AND NEVER it starts on its own

WHEN tap the play disc -> the clip plays AND the sound control takes the disc's corner

WHEN drag the seek line -> the clip moves under the finger

WHEN tap the sound control -> sound turns on or off as the one sticky decision every video shares

WHEN tap the score -> the clip squishes to the head of the post's detail still playing AND the post rises beneath it AND NEVER a page slides in over the stream

WHEN tap the opinion face -> the same pad opens over the clip AND the clip pauses

WHEN the pad over the clip closes GIVEN the clip was playing when the pad opened -> the stream resumes the same clip at its position

WHEN the hold's signing does not go through -> the opinion face stays where it was AND the line beside it reads That didn't sign. in the failure voice followed by Retry, on the stream's plate AND NEVER the snackbar carries the failure

WHEN the write rule refuses a hold's signing -> the opinion face stays where it was AND the line beside it reads You can't sign right now. in the quiet secondary ink, on the stream's plate AND NEVER Retry appears

ALWAYS a line on the stream's plate stands until it is answered, another act is made on the same face or the clip leaves the screen, and never fades on a timer

WHEN tap the comment count -> the same comments sheet opens over the clip AND the clip stops

WHEN tap the opinion face GIVEN the reader is signed out -> the join prompt opens over the paused clip

WHEN press the way back GIVEN the stream was opened from the feed it narrowed -> the stream closes on the feed it narrowed

WHEN press the way back GIVEN the stream was opened from anywhere else -> the stream closes onto where it was opened, the state the reader left exactly

ALWAYS the way back reads Back to feed from the feed it narrowed, Back to the post from a post's clip detail, Back to the profile from another's posts, Back to your profile from the reader's own and Back to History from History

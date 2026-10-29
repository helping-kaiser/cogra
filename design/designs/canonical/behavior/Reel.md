# Reel · `spec:design:behavior-reel`

ALWAYS the stream carries only clips taller than they are wide, from the list it was opened from narrowed to them in that list's order — the feed it narrowed, History's rows or the profile's posts — and by no ranking of its own

ALWAYS no header labels the stream

ALWAYS reel.stage runs the clip at its own full frame, edge to edge below the system status bar

ALWAYS the system status bar stays the system's, its strip never painted black or any colour by the stream, reel.washTop and reel.washBottom included

ALWAYS the stream wears reel.soundDisc and reel.seekLine, and never a pause or the full transport

ALWAYS reel.seekLine rides directly above reel.bottomBar, never on the screen's bottom edge

ALWAYS reel.seekLine's ink stays a 3px line and its touch target is 48dp, rising from the track, with reel.caption standing clear above that target

ALWAYS reel.bottomBar stays on the stream

ALWAYS reel.rail reads, top to bottom, reel.rail.author, reel.rail.stance, reel.rail.comments, reel.rail.share and reel.rail.score

ALWAYS reel.rail.score is the same figure the card wears, the one the latest fetch of the post found

ALWAYS reel.rail.score is the door to the post, whichever face it wears

ALWAYS reel.rail.score stands as the bare graph glyph with reel.rail.score.settling, Still settling, under it inside the door, never a 0, a dash or a placeholder, GIVEN the clip is still settling, under Ranked and Newest alike

WHEN the trace's fetch finds other than reel.rail.score -> reel.rail.score.value reads what it found, a dash where it found no paths AND NEVER the figure it wore before

WHEN the feed is fetched again GIVEN reel.rail.score reads what the trace's fetch found -> reel.rail.score.value reads what that fetch computed

ALWAYS the stream pages vertically, a swipe up bringing the next clip and a swipe down the one before, from the tapped clip both ways through the list's clips

WHEN swipe up on reel.stage -> the next clip in the same list takes the screen

WHEN swipe down on reel.stage GIVEN a clip stands before it in the list -> the clip before it takes the screen AND NEVER the stream closes

WHEN swipe down on reel.stage GIVEN it is the list's first -> the clip stays AND NEVER the stream closes AND NEVER it wraps to the last

ALWAYS the stream never moves on to the next clip by itself

ALWAYS reel.caption.notice reads That's the last clip here. at reel.caption's head, on the stream's plate, GIVEN the list holds no clip after the one on screen

WHEN swipe up on reel.stage GIVEN it is the list's last -> the clip stays AND NEVER the stream wraps to the first

WHEN swipe up on reel.stage GIVEN the next clips have not loaded and their load fails -> the clip on screen stays and plays on AND reel.caption.notice reads Couldn't load more with reel.caption.notice.retry, Retry, at reel.caption's head on the stream's plate AND NEVER the stream closes AND NEVER an empty frame takes the screen

WHEN tap reel.caption.notice.retry -> the next clips are asked for again AND reel.caption.notice goes once they come

WHEN the stream opens GIVEN the device suppresses autoplay -> the tapped clip stands paused on its cover AND reel.playDisc, the card's own, stands in reel.soundDisc's corner AND NEVER the clip starts on its own

WHEN swipe to another clip GIVEN the device suppresses autoplay -> that clip stands paused on its cover with reel.playDisc AND NEVER it starts on its own

WHEN tap reel.playDisc -> the clip plays AND reel.soundDisc takes the disc's corner

WHEN drag reel.seekLine -> the clip moves under the finger

WHEN tap reel.soundDisc -> sound turns on or off as the one sticky decision every video shares

WHEN tap reel.rail.score -> the clip squishes to the head of the post's detail still playing AND the post rises beneath it AND NEVER a page slides in over the stream

WHEN tap reel.rail.stance.anchor -> the same pad opens over the clip AND the clip pauses

WHEN the pad over the clip closes GIVEN the clip was playing when the pad opened -> the stream resumes the same clip at its position

WHEN the hold's signing does not go through -> reel.rail.stance.anchor.face stays where it was AND reel.rail.stanceLine beside it reads That didn't sign. in the failure voice followed by reel.rail.stanceLine.retry, Retry, on the stream's plate AND NEVER reel.snackbar carries the failure

WHEN the write rule refuses a hold's signing -> reel.rail.stance.anchor.face stays where it was AND reel.rail.stanceLine beside it reads You can't sign right now. in the quiet secondary ink, on the stream's plate AND NEVER reel.rail.stanceLine.retry appears

ALWAYS a line on the stream's plate stands until it is answered, another act is made on the same face or the clip leaves the screen, and never fades on a timer

WHEN tap reel.rail.comments -> the same comments sheet opens over the clip AND the clip stops

WHEN tap reel.rail.share -> the platform's own share sheet opens with the post's link

WHEN tap reel.rail.share GIVEN the platform has no share sheet -> the link lands on the clipboard AND reel.snackbar reads Link copied, at the house snackbar's place above reel.bottomBar

WHEN tap reel.rail.stance.anchor GIVEN the reader is signed out -> the join prompt opens over the paused clip

WHEN tap reel.rail.author -> the author's profile opens AND its back arrow reads Back to the stream

WHEN press reel.backDisc GIVEN the stream was opened from the feed it narrowed -> the stream closes on the feed it narrowed

WHEN press reel.backDisc GIVEN the stream was opened from anywhere else -> the stream closes onto where it was opened, the state the reader left exactly

ALWAYS reel.backDisc reads Back to feed from the feed it narrowed, Back to the post from a post's clip detail, Back to the profile from another's posts, Back to your profile from the reader's own and Back to History from History

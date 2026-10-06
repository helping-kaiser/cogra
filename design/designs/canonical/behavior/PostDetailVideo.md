# PostDetailVideo · `spec:design:behavior-post-detail-video`

ALWAYS the clip stands pinned above the card and the author chip leads the card

ALWAYS the transport carries play and pause between the two skips, and elapsed, the timeline, total, sound and the fullscreen toggle on its bar

ALWAYS the transport is the same for every clip whatever its length

WHEN the clip plays to its end -> it stops AND offers replay AND NEVER it loops

WHEN tap play or pause -> the clip stops or starts where it is

WHEN tap a skip -> the clip moves ten seconds back or forward

WHEN tap or drag the seek line -> the clip moves under the finger

WHEN tap the sound control -> sound turns on or off as the one sticky decision every video shares

WHEN tap the clip GIVEN the web's transport chrome has auto-hidden -> the chrome comes back AND NEVER the viewer opens

ALWAYS the transport chrome stays up on Android

WHEN tap the pinned clip GIVEN the reader came from the stream, on Android or with the web's transport chrome up -> the clip expands back into the stream AND the reader's place there is held

WHEN tap the pinned clip GIVEN the reader came from anywhere else, on Android or with the web's transport chrome up -> the fullscreen viewer opens on the clip

WHEN tap the fullscreen toggle -> the fullscreen viewer opens on the clip

WHEN tap the comment count -> the comments sheet opens over the post AND the clip stops

WHEN a sheet or a dialog opens over the post -> the clip stops where it is

WHEN the sheet or the dialog over the post dismisses GIVEN the clip was playing when it rose and the device allows autoplay -> the clip resumes where it stopped

WHEN the sheet or the dialog over the post dismisses GIVEN the reader had paused the clip -> NEVER the clip resumes on its own

WHEN the sheet or the dialog over the post dismisses GIVEN the device suppresses autoplay -> NEVER the clip starts on its own

WHEN the opinion pad opens over the post GIVEN the clip is playing -> the clip pauses where it is

WHEN the opinion pad over the post closes GIVEN it paused the clip, under suppressed autoplay included -> the clip resumes where it paused

WHEN the detail opens from a card whose clip has played -> the pinned clip stands at the frame the card's clip reached AND NEVER the clip starts over

WHEN back leaves the detail for the card it was opened from -> the card's clip stands at the frame the pinned clip reached AND NEVER the stored still returns

WHEN the fullscreen viewer opens over the post -> the pinned clip stops AND NEVER it plays behind the viewer

WHEN the fullscreen viewer closes GIVEN the viewer's clip was playing -> the pinned clip plays on from the position the viewer's clip reached AND NEVER the clip starts over

WHEN the fullscreen viewer closes GIVEN the viewer's clip was paused -> the pinned clip stands paused at the position the viewer's clip reached AND NEVER the clip starts over

WHEN the phone turns to landscape GIVEN the detail holds a landscape clip -> the fullscreen viewer opens on the clip, filling the turned screen

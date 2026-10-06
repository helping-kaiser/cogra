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

WHEN the phone turns to landscape GIVEN the detail holds a landscape clip -> the fullscreen viewer opens on the clip, filling the turned screen

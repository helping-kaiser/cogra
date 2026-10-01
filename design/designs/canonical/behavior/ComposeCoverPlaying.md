# ComposeCoverPlaying · `spec:design:behavior-compose-cover-playing`

ALWAYS the transport carries play and pause between the two skips, and elapsed, the timeline, total and sound on its bar

ALWAYS the transport carries no fullscreen toggle

WHEN the preview starts playing -> the cover gives way to the running clip AND NEVER the cover comes back

WHEN tap play or pause -> the preview stops or starts where it is AND NEVER the cover comes back

WHEN tap a skip -> the preview moves ten seconds back or forward

WHEN tap or drag the seek line -> the preview moves under the finger

WHEN tap the sound control -> sound turns on or off as the one sticky decision every video shares

WHEN tap a frame -> that frame is the clip's cover AND the strip stands as it did before playing

WHEN press Next -> the details stage opens AND NEVER an Add a cover door stands there

WHEN press the header X -> the whole flow is left AND the draft is kept AND NEVER a dialog asks

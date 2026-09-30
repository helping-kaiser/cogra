/* THE STREAM, ON A SENSITIVE CLIP (jakob 2026-09-30, the fifteen-first ruling
   round, #14): a veiled reel is full screen and looks exactly like any other
   reel in the stream — the same clip edge to edge, the same rail, caption and
   bottom bar — but it is blurred and does not play. Reached the way `Reel` is,
   when the clip on the stage is sensitive and unrevealed: the state the record
   brings, not a different tap or swipe.

   THE VEIL IS THE STANDARD ONE, UNCHANGED. `SensitiveVeil`'s media face lies
   over the whole clip — the mark, whose mark it is, and the reason — and the
   caption's words veil the way a card's do, the handle and title staying
   readable so choosing to look is informed. ONE `SensitiveScope` spans the
   clip and the caption: the reveal is per post, so either face reveals both.

   NOTHING PLAYS BENEATH A VEIL (backlog item 103; `MediaAttachment`'s stage
   law): a veiled clip has no playback and no sound-disc presence, so the sound
   disc and the seek line — the stream's rung of the control ladder — go with
   it, as the transport goes on `PostDetailVideoSensitive`. The rail stays
   live: the acts on a post never waited on its veil.

   THE REVEAL IS SESSION-SCOPED (readme §13, the veil's scope): it survives
   every move inside the app and returns on a full app close or another hard
   reset of the media. It is an ELIGIBILITY CHANGE, not a suspension lift —
   the unveiled clip joins the rotation as a clip scrolling into view does,
   and on the stream it is the only clip in view, so it takes the stage and
   plays: the screen becomes `Reel`. The score's detail door opens
   `PostDetailVideoSensitive`, the same post still veiled.

   The stream has no behavior sidecar, so nothing here is written as one: every
   outcome above follows from the recorded veil and stage laws. */

const SENSITIVE_MIRA_CLIP = { reason: "One rubbing includes a dead seabird." };

export function Screen() {
  return (
    <div data-theme="dark" style={{ position: "absolute", inset: 0, background: "#000", overflow: "hidden" }}>
      <SensitiveScope>
        <div style={{ position: "absolute", inset: 0, display: "grid" }}>
          {/* The face's words keep clear of the rail the way the caption does
              (its right edge at 76px), on both sides so the face stays centred. */}
          <SensitiveVeil kind="media" reason={SENSITIVE_MIRA_CLIP.reason} faceGutter="76px">
            <img
              src="clip-lakeside.jpg"
              alt="A man standing at the edge of a lake as the light drops."
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
          </SensitiveVeil>
        </div>
        {/* The stream's two washes, as `Reel` draws them — inert here, so the
            veil beneath them keeps the whole frame as its tap. */}
        <div
          aria-hidden="true"
          style={{ position: "absolute", left: 0, right: 0, top: 0, height: 140, background: "linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0))", pointerEvents: "none" }}
        />
        <div
          aria-hidden="true"
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 260, background: "linear-gradient(to top, rgba(0,0,0,0.62), rgba(0,0,0,0))", pointerEvents: "none" }}
        />

        <MediaDisc label="Back to feed" glyph="arrow_back" corner="top-left" onClick={() => {}} />

        <ReelRail
          author={{ handle: MIRA.handle, displayName: MIRA.displayName, src: "inviter.jpg" }}
          score={MIRA_CLIP_POST.score}
          comments={MIRA_CLIP_POST.comments}
          bottom={BAND_HEIGHT + 96}
        />
        <ReelCaption
          handle={MIRA.handle}
          title={MIRA_CLIP_POST.title}
          description={MIRA_CLIP_POST.description}
          bottom={BAND_HEIGHT + 22}
          sensitive
        />

        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 4 }}>
          <BottomNav active="feed" slots={ALL_SLOTS} inline />
        </div>
      </SensitiveScope>
    </div>
  );
}

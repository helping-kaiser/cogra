/* THE STREAM (readme §13, the reel round, jakob 2026-09-03). A portrait clip's
   tap opens this: the list it was tapped in — the reader's OWN ranked feed, the
   one the board draws, or History's rows, or a profile's posts — narrowed to
   clips taller than they are wide, in that list's order (jakob 2026-10-12).
   Same graph, same order, a mechanical filter —
   there is no second algorithm here, and no header says otherwise, because a
   label announcing "your feed" is the kind of reassurance only a product that
   ranks two ways ever needs. What says it instead is the SCORE on the rail: the
   same number the card wore, still the reader's own reach into this post.

   The clip runs at its native 9:16, edge to edge — this is the surface the
   card's 4:5 clamp exists against. The stream pages vertically: up brings the
   next clip, down the one before, from the tapped clip both ways through the
   list; it never wraps and never moves on by itself.

   THE STATUS BAR IS NOT THE STREAM'S (jakob 2026-10-09, seam 117): the black
   and the top wash end below the system status bar and never paint its strip.
   The board is the inset-zero case (readme §13, *The viewer-grammar close*),
   so its `inset: 0` is what stands below the bar on a device.

   THE BOTTOM BAR STAYS (jakob, review round 1 — Instagram, TikTok and YouTube
   all keep theirs on a stream, and so does this): the stream is a way of reading
   the feed, not a place outside the app, so the way to every other tab stays
   where it always is. The seek line sits DIRECTLY ABOVE THE BAR — never on the
   screen's own edge, where Android's system gesture zone would take the drag
   and close the app instead.

   NO TARGET ON THE STREAM FALLS BELOW 48dp (rulings 92 and 101, RL-G11). The
   seek line's 3px ink stays on the bar; its 48px target rises from the track,
   and the caption stands 66px above the bar so the target and `More`'s own
   48px target meet without overlapping. The ink does not move.

   THE CHROME: the way back top-left and the sound disc top-right, both on the
   media disc's surface because they sit on photography; the rail down the right,
   white and shadowed so it survives a bright frame; the caption above the bar.
   No pause: a clip in a stream plays, and stopping it is what the detail view is
   for. The one play is the card's own: where the device suppresses autoplay the
   clip stands paused on its cover and the play disc takes the sound disc's
   corner until the tap starts it (RL-G3).

   THE `state` CHIP draws the stream's other faces, each one change from
   `playing`: `suppressed` (the play disc); `settling` (the rail's score door a
   bare glyph over `Still settling`, RL-G7); `moved` (the door reads the dash —
   the trace's fetch found no paths, jakob 2026-10-12); `end` (the last clip's
   line at the caption's head, RL-G4); `fault` (the load that did not come, the
   clip still playing, RL-G13); `unsigned` and `refused` (a hold's row line
   beside the face, RL-G8). Every line stands on the stream's plate. */
export const PROPS = {
  state: {
    editor: "enum",
    options: ["playing", "suppressed", "settling", "moved", "end", "fault", "unsigned", "refused"],
    default: "playing",
  },
};
export const VALS = `soundDisc: this.props.state === "suppressed" ? "none" : "contents", playDisc: this.props.state === "suppressed" ? "contents" : "none", railFigure: this.props.state === "settling" || this.props.state === "moved" ? "none" : "contents", railSettling: this.props.state === "settling" ? "contents" : "none", railDash: this.props.state === "moved" ? "contents" : "none", lineUnsigned: this.props.state === "unsigned" ? "block" : "none", lineRefused: this.props.state === "refused" ? "block" : "none", lineEnd: this.props.state === "end" ? "block" : "none", lineFault: this.props.state === "fault" ? "block" : "none"`;

export function Screen() {
  return (
    <div data-theme="dark" style={{ position: "absolute", inset: 0, background: "#000", overflow: "hidden" }}>
      <img
        src="clip-lakeside.jpg"
        alt="A man standing at the edge of a lake as the light drops."
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      />
      {/* The two washes: chrome over photography needs its own contrast, and a
          gradient does it without drawing a bar across the frame. */}
      <div
        aria-hidden="true"
        style={{ position: "absolute", left: 0, right: 0, top: 0, height: 140, background: "linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0))" }}
      />
      <div
        aria-hidden="true"
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 260, background: "linear-gradient(to top, rgba(0,0,0,0.62), rgba(0,0,0,0))" }}
      />

      <MediaDisc label="Back to feed" glyph="arrow_back" corner="top-left" onClick={() => {}} />
      <span style={{ display: "{{soundDisc}}" }}>
        <MediaDisc label="Turn sound on" glyph="volume_off" corner="top-right" pressed={false} onClick={() => {}} />
      </span>
      <span style={{ display: "{{playDisc}}" }}>
        <MediaDisc label="Play this video" glyph="play_arrow" corner="top-right" onClick={() => {}} />
      </span>

      <ReelRail
        author={{ handle: MIRA.handle, displayName: MIRA.displayName, src: "inviter.jpg" }}
        comments={MIRA_CLIP_POST.comments}
        bottom={BAND_HEIGHT + 96}
        scoreSlot={
          <>
            <span style={{ display: "{{railFigure}}" }}>
              <ReelRailScore score={MIRA_CLIP_POST.score} />
            </span>
            <span style={{ display: "{{railSettling}}" }}>
              <ReelRailScore settling />
            </span>
            <span style={{ display: "{{railDash}}" }}>
              <ReelRailScore score="—" />
            </span>
          </>
        }
        stanceLine={
          <>
            <div style={{ display: "{{lineUnsigned}}" }}>
              <ReelPlate role="alert">
                <span style={{ color: "var(--text-failure)" }}>That didn&apos;t sign.</span>
                <InlineAction size="sm" onClick={() => {}}>
                  Retry
                </InlineAction>
              </ReelPlate>
            </div>
            <div style={{ display: "{{lineRefused}}" }}>
              <ReelPlate>
                <span style={{ color: "var(--text-secondary)" }}>You can&apos;t sign right now.</span>
              </ReelPlate>
            </div>
          </>
        }
      />
      <ReelCaption
        handle={MIRA.handle}
        title={MIRA_CLIP_POST.title}
        description={MIRA_CLIP_POST.description}
        bottom={BAND_HEIGHT + 66}
        notice={
          <>
            <div style={{ display: "{{lineEnd}}" }}>
              <ReelPlate>
                <span style={{ color: "var(--text-secondary)" }}>That&apos;s the last clip here.</span>
              </ReelPlate>
            </div>
            <div style={{ display: "{{lineFault}}" }}>
              <ReelPlate>
                <span style={{ color: "var(--text-secondary)" }}>Couldn&apos;t load more</span>
                <InlineAction size="sm" ariaLabel="Retry loading more" onClick={() => {}}>
                  Retry
                </InlineAction>
              </ReelPlate>
            </div>
          </>
        }
      />

      <div style={{ position: "absolute", left: 0, right: 0, bottom: BAND_HEIGHT + 4, zIndex: 3 }}>
        <SeekLine progress={0.34} elapsed="0:14" duration="0:41" />
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 4 }}>
        <BottomNav active="feed" slots={ALL_SLOTS} inline />
      </div>
    </div>
  );
}

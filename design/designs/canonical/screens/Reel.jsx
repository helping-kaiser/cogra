/* THE STREAM (readme §13, the reel round, jakob 2026-09-03). A portrait clip's
   tap in the feed opens this: the reader's OWN ranked feed, narrowed to clips
   taller than they are wide. Same graph, same ranking, a mechanical filter —
   there is no second algorithm here, and no header says otherwise, because a
   label announcing "your feed" is the kind of reassurance only a product that
   ranks two ways ever needs. What says it instead is the SCORE on the rail: the
   same number the card wore, still the reader's own reach into this post.

   The clip runs at its native 9:16, edge to edge — this is the surface the
   card's 4:5 clamp exists against. Swiping moves to the next clip.

   THE CHROME: the way back top-left and the sound disc top-right, both on the
   media disc's surface because they sit on photography; the rail down the right;
   the caption along the bottom; and the seek line on the very bottom edge — the
   stream's whole transport, drag to move inside the clip. No play/pause: a clip
   in a stream plays, and stopping it is what the detail view is for. */
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

      <MediaDisc label="Back to the feed" glyph="arrow_back" corner="top-left" onClick={() => {}} />
      <MediaDisc label="Turn sound on" glyph="volume_off" corner="top-right" pressed={false} onClick={() => {}} />

      <ReelRail score="7.40" comments={2} />
      <ReelCaption
        handle="mira"
        title="The lake, doing nothing, for forty seconds"
        content="Stood there long enough that the midges found me. Worth it for the last ten seconds, when the far shore goes the colour of the water."
      />

      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 3 }}>
        <SeekLine progress={0.34} elapsed="0:14" duration="0:41" />
      </div>
    </div>
  );
}

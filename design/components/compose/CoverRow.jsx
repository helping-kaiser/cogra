import React from "react";
import { Icon } from "../navigation/Icon.jsx";
import { MediaThumb } from "./MediaThumb.jsx";

/* The video's face (item 17, the conformance round): the strip of frames cut
   from the clip, plus the one tile that is not a frame at all.

   FOUR FRAMES, NOT THREE (jakob 2026-09-03): 1s, 10%, 50%, 90% of the clip. 1s
   clears the fade-in black that t=0 so often is, and the three ratios spread
   the rest. On a clip short enough that two samples land on the same frame they
   collapse and fewer tiles show — offering the same picture twice is a choice
   that isn't one, so the strip takes the frames it is given and draws no
   placeholder for a fifth.

   THE CHOSEN FRAME IS OUTLINED, THE REST ARE DIMMED. Selection is the primary
   outline offset off the tile, not a check badge — the tiles are 56px and a
   badge at that size covers the thing being chosen. The unchosen frames sit at
   65% so the strip reads as one picture framed several ways, which is what it
   is.

   AND NOTHING IS CHOSEN UNTIL SOMEONE CHOOSES (jakob 2026-09-15): "choosing a
   cover is always a willing act". The default is no cover, so the row opens
   with no outline and nothing dimmed — four equal candidates. The dim is what
   the rest of a strip does around a frame that was picked, and until one is
   picked there is no rest.

   THE LAST TILE IS A DIFFERENT KIND OF THING and says so by not being a
   photograph: a dashed square with the picture glyph, the same shape as the
   frames so the row still scans as one strip. It is the way out to the gallery,
   and a picture chosen there goes through `CropViewport` first, because a
   picture of your own is the only cover that can disagree with the clip's
   shape.

   THE ROW IS THE WHOLE CLUSTER — the "Cover" field label and the strip, and a
   line underneath only where the row has something to explain: the frame strip
   and the own-picture tile show the choice themselves (jakob 2026-11-12). The
   comment composer inlines it at 56px and the post's cover stage draws it larger.

   NO FRAMES IS A STATE THE ROW HOLDS (video-cover round, 2026-09-10): hand it
   an empty `frames` and what remains is the way out to the gallery, alone,
   under a `caption` that says why. Extraction can come back with nothing, and
   a strip of blank tiles would offer pictures that do not exist. The row shrinks
   to the one path that still works rather than growing a state of its own.

   THE ROW IS NOT ALWAYS THERE (same round). A vertical clip's default is no
   cover, so at comment scale the row gives way to an "Add a cover" door and
   appears when the door is opened; a horizontal or square clip wears it from
   the start. The row draws the choosing, never the decision to choose.

   A PICTURE OF YOUR OWN STANDS WHERE IT WAS ASKED FOR (round 52, jakob
   2026-11-17, decision 4). Back from the cover's crop, the picture takes
   the dashed tile's place in the strip — `own`, its framing the crop's —
   outlined as chosen, the frames dimmed around it as around a chosen frame.
   A tap on it opens the picker again, the way the edits' cover door does:
   the picture is re-picked and re-cropped, never re-framed in place. */

const TILE = {
  width: 56,
  height: 56,
  borderRadius: "var(--radius-small)",
  overflow: "hidden",
  flex: "none",
};

const FILL = { width: "100%", height: "100%", objectFit: "cover", display: "block" };

export function CoverRow({
  label = "Cover",
  frames = [],
  selected = null,
  /* A picture of the author's own, back from the cover's crop: `{ src,
     transform }`. It stands in the dashed tile's place, and it is the
     chosen cover — `selected` is ignored while it stands. */
  own,
  caption,
}) {
  const chosen = Boolean(own) || (selected !== null && selected !== undefined);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span
        style={{
          fontSize: "var(--text-label-large)",
          lineHeight: "var(--text-label-large--line-height)",
          fontWeight: "var(--text-label-large--font-weight)",
          letterSpacing: "var(--text-label-large--letter-spacing)",
        }}
      >
        {label}
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        {frames.map((frame, index) => (
          <div
            key={frame.src ? `${frame.src}-${index}` : index}
            className="cg-cover-frame"
            style={
              index === selected && !own
                ? { ...TILE, outline: "2px solid var(--primary)", outlineOffset: 1 }
                : chosen
                  ? { ...TILE, opacity: 0.65 }
                  : TILE
            }
          >
            <img src={frame.src} alt="" style={frame.transform ? { ...FILL, transform: frame.transform } : FILL} />
          </div>
        ))}
        {own ? (
          <div className="cg-cover-own" style={{ ...TILE, outline: "2px solid var(--primary)", outlineOffset: 1 }}>
            <img src={own.src} alt="" style={own.transform ? { ...FILL, transform: own.transform } : FILL} />
          </div>
        ) : (
        <div
          className="cg-cover-own"
          style={{
            width: 56,
            height: 56,
            borderRadius: "var(--radius-small)",
            border: "1px dashed var(--border-field)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-secondary)",
            boxSizing: "border-box",
            flex: "none",
          }}
        >
          <Icon name="image" size={20} />
        </div>
        )}
      </div>
      {caption && (
        <p style={{ margin: 0, fontSize: "var(--text-label-small)", fontWeight: "var(--text-label-small--font-weight)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "var(--text-label-small--letter-spacing)", color: "var(--text-secondary)" }}>
          {caption}
        </p>
      )}
    </div>
  );
}

/* THE COVER BESIDE THE CLIP (round 52, jakob 2026-11-17, decision 4 — his
   hand test's W22: "the cover beeing full size and next to the video … this
   way we also have a entrance gate for changing the cover"). Wherever a flow
   shows a clip after a cover can exist, the cover stands as its own tile
   beside the clip's: at the clip tile's height and at the cover's own shape
   — a tall clip's 4:5, a square's 1:1, a wide's 16:9 — wearing the `Cover`
   pill a post's first picture wears (`MediaThumb`'s `cover`).

   THE TILE IS THE DOOR. Pressed, it opens what changes the cover where it
   stands — the cover step on a new post, the picker and the cover's crop on
   an edit — and it is named for that, `Change the cover`, so the pill
   names what it is and the name says what it does.

   NO COVER YET, THE SAME PLACE HOLDS THE OTHER HALF: a dashed tile at the
   same size, the add glyph in its exact middle, and the words `Add a cover`
   — on the tile, 4 under the glyph, where it is wide enough to carry them, beside it as the door's own label
   where it is not (`labelBeside`, which the placer sets from the tile it
   measured). One control either way: the tile and its words are one press. */
const ADD_WORDS = {
  fontSize: "var(--text-label-small)",
  fontWeight: "var(--text-label-small--font-weight)",
  lineHeight: "var(--text-label-small--line-height)",
  letterSpacing: "var(--text-label-small--letter-spacing)",
  color: "var(--primary)",
  whiteSpace: "nowrap",
};

export const CHANGE_COVER_NAME = "Change the cover";

export function CoverTile({ src, transform, width, height, progress, failed = false, addLabel = "Add a cover", labelBeside = false, onPress, node }) {
  if (src) {
    return (
      <button
        type="button"
        aria-label={CHANGE_COVER_NAME}
        onClick={onPress}
        className="cg-state cg-focus"
        style={{ display: "inline-flex", flex: "none", padding: 0, border: 0, background: "none", borderRadius: "var(--radius-small)", cursor: "pointer" }}
        data-node={node}
      >
        <MediaThumb src={src} transform={transform} width={width} height={height} cover progress={progress} failed={failed} />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onPress}
      className="cg-state cg-focus"
      style={{ display: "inline-flex", alignItems: "center", gap: 8, flex: "none", padding: 0, border: 0, background: "none", borderRadius: "var(--radius-small)", cursor: "pointer", textAlign: "left" }}
      data-node={node}
    >
      <span
        style={{
          width: `${width}px`,
          height: `${height}px`,
          borderRadius: "var(--radius-small)",
          border: "1px dashed var(--border-field)",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          color: "var(--text-secondary)",
          flex: "none",
          ...(labelBeside ? {} : { position: "relative" }),
        }}
      >
        <Icon name="add" size={20} />
        {/* THE GLYPH HOLDS THE TILE'S EXACT MIDDLE, THE WORDS STAND UNDER IT
            (round 53 act 2, jakob 2026-11-17: "the '+' sign should be in the
            middle of the square … and the words below it"). The glyph is the
            flex column's one child, so it centres on both axes alone; the
            words are taken out of the flow and set 4 below the glyph's
            20 px box — the gap the group kept — centred across the tile. */}
        {!labelBeside && (
          <span style={{ ...ADD_WORDS, position: "absolute", left: 0, right: 0, top: "calc(50% + 14px)", textAlign: "center" }}>{addLabel}</span>
        )}
      </span>
      {labelBeside && <span style={ADD_WORDS}>{addLabel}</span>}
    </button>
  );
}

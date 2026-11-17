Use `MediaThumb` for every authoring-side picture tile — the pick tray, the details row, the Show all sheet, the reply composer, the comment edit. Never hand-draw a composer thumbnail: the states are the point.

```jsx
<MediaThumb src={a} cover />                    {/* the first picture — the badge travels with reorder */}
<MediaThumb src={b} progress={0.65} />          {/* uploading — ring on a scrim */}
<MediaThumb src={c} failed />                   {/* didn't upload — dimmed + badge; words in UploadErrorLine */}
<MediaThumb src={d} onRemove={remove} />        {/* the X, top-right */}
<MediaThumb src={e} size={88} />               {/* a comment's picture — the square its author framed */}
<MediaThumb src={f} video duration="0:18" width={220} height={220} />  {/* a video and its cover */}
<MediaThumb src={g} cover width={114} height={64} />  {/* a clip's cover, its own tile beside the clip (CoverTile) */}
```

What holds:

- **Upload starts after the crop.** The crop happens on the device and only the cropped export is ever uploaded — the original can hold what the author never meant to share. A comment's pictures pass the comment's square crop and upload from its Next, the same way. The `progress` ring is that story on the tile.
- **A failed tile dims and wears the badge; its words live beside the row** (`UploadErrorLine` — "One picture didn't upload. Retry · Remove it"). Never cram retry into 48px.
- The remove X hides on a failed tile — the line owns that tile's ways out.
- **`video` draws the composer's video preview** — the play disc on the frame, the duration on the trailing corner (the pill needs an 80px tile). This is authoring-side only: a reading surface never draws play/pause, where presence on screen is the policy (`MediaAttachment`).
- **A clip's cover is its own tile beside the clip's** (`CoverTile`, round 52) — at the clip tile's height and the cover's own shape, wearing the same `cover` badge; the tile is the door that changes it. `transform` carries a frame's own framing, the way `CoverRow`'s tiles carry theirs.
- **`coverSrc` is the inset the reply composer's clip tile still names** (its law waits on jakob, round 52) — the chosen frame inset in the bottom-left corner at a third of the tile's short side (28px floor) behind a hairline ring; no other surface draws it.
- Default is a 48px square at the small (8px) rung; the Show all sheet uses 56.
- **A clip's tiles keep their drawn boxes for every clip shape** — the tray's 114×64 and the details stage's 54×96 — and the clip's frame fills each, cropped to it, whatever the clip's own shape (jakob's call, kept; seam 245, ask 13 K) — a horizontal or square clip on the details stage and on an edit of a clip post included, as both clients build it (seam 248, GAP D). In the composer, only the cover step's preview stands at the clip's own shape.

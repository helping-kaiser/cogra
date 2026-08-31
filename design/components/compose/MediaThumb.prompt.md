Use `MediaThumb` for every authoring-side picture tile — the pick tray, the details row, the Show all sheet, the reply composer, the comment edit. Never hand-draw a composer thumbnail: the states are the point.

```jsx
<MediaThumb src={a} cover />                    {/* the first picture — the badge travels with reorder */}
<MediaThumb src={b} progress={0.65} />          {/* uploading — ring on a scrim */}
<MediaThumb src={c} failed />                   {/* didn't upload — dimmed + badge; words in UploadErrorLine */}
<MediaThumb src={d} onRemove={remove} />        {/* the X, top-right */}
<MediaThumb src={e} width={70} height={88} fit="contain" />  {/* uncropped (comments) — whole frame */}
```

What holds:

- **Upload starts after the crop.** The crop happens on the device and only the cropped export is ever uploaded — the original can hold what the author never meant to share. Comment pictures never crop, so they upload at pick. The `progress` ring is that story on the tile.
- **A failed tile dims and wears the badge; its words live beside the row** (`UploadErrorLine` — "One picture didn't upload. Retry · Remove it"). Never cram retry into 48px.
- The remove X hides on a failed tile — the line owns that tile's ways out.
- Default is a 48px square at the small (8px) rung; the Show all sheet uses 56.

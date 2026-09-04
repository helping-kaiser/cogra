The strip that picks a video's face — frames from the clip, or a picture of your own.

```jsx
<CoverRow
  frames={[
    { src: "frame.jpg" },
    { src: "frame.jpg", transform: "scale(1.25) translateX(-4%)" },
    { src: "frame.jpg", transform: "scale(1.5)" },
    { src: "frame.jpg", transform: "scale(1.8) translateY(6%)" },
  ]}
  selected={0}/>
```

**Four frames, at 1s, 10%, 50% and 90% of the clip.** 1s clears the fade-in black that t=0 so often is; the three ratios spread the rest. On a clip short enough that two samples land on the same frame, they collapse and you pass fewer frames — offering the same picture twice is a choice that isn't one. Never pad the strip back to four with a placeholder.

**Selection is an outline, not a badge.** The tiles are 56px, and a check badge at that size covers the thing being chosen. The unchosen frames sit at 65%, so the strip reads as one picture framed several ways.

**The dashed tile is the gallery, and it is drawn as not-a-photograph** — same square, no image, the picture glyph in secondary. A picture chosen there goes through `CropViewport` before it comes back: a frame already carries the clip's shape, and only a picture of your own can disagree with it.

The row carries its own label and its own line because the three never appear apart. The comment composer inlines it beneath the clip; the post wizard gives it a stage.

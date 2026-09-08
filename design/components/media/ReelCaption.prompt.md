`ReelCaption` puts the post's words along the bottom of a clip in the stream.

```jsx
<ReelCaption handle="mira" title={post.title} description={post.description} bottom={BAND_HEIGHT + 22} />
```

What holds:

- **The card's budget, not more**: handle, title, the description clamped to two lines, and the same `More` opener a card uses. A stream that spends more than that on words is a feed with a video behind it.
- **The words are the description.** A clip post's body is its media, so what rides beside it is the caption, never a second body (post.md's words XOR media).
- **A text shadow, never a plate.** A panel behind the words would cover the frame they sit on — the same reason the rail's glyphs take a shadow instead of discs.
- **It clears the rail and the bar**: inset from the right so it never runs under the rail, and lifted by `bottom` so it sits above the bottom bar and the seek line.
- **The author's face is not here.** It is the rail's first item, because acting on a person begins there.

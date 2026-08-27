**Proposed, not shipped.** `MediaViewer` is the full-media view — the one place media is shown at whatever size the screen allows.

```jsx
{viewing !== null && (
  <MediaViewer items={post.media} index={viewing} onClose={() => setViewing(null)} />
)}
```

Reach for it from a post's **detail** view, where tapping media opens it. Never from the feed: there, a tap on media opens the post, because a reader scrolling a feed is choosing between posts, not looking at one picture.

What holds:

- **The frame is never cropped here.** `contain`, centred, as large as the viewport allows. The 4:5 cap and any gallery crop are feed-layout devices; this view exists so neither one loses anything.
- **It is backed out of, not navigated away from.** `arrow_back`, Escape, and the backdrop all close it, and the route never changes — the reader lands back exactly where they were.
- **Nothing else is drawn.** No zoom, no share, no toolbar. A plain `n of m` and the two arrows for a set, and that is all.
- A **video takes real controls here** — a feed tile has only sound, because there it plays by being on screen. In the viewer the reader is deliberately watching, so give them the scrubber.

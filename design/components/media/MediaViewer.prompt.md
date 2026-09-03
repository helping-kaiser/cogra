**Proposed, not shipped.** `MediaViewer` is the full-media view — the one place media is shown at whatever size the screen allows.

```jsx
{viewing !== null && (
  <MediaViewer items={post.media} index={viewing} onClose={() => setViewing(null)} />
)}
```

Reach for it from a post's **detail** view, where tapping media opens it. Never from the feed: there, a tap on media opens the post, because a reader scrolling a feed is choosing between posts, not looking at one picture.

What holds:

- **The frame is never cropped here.** `contain`, centred, as large as the viewport allows. The 4:5 cap, a gallery crop, and a portrait clip's centre-crop are all card-layout devices; this view exists so none of them loses anything.
- **It is dismissed, not navigated away from.** An X, a swipe **down**, Escape, and the backdrop all close it, and the route never changes — the reader lands back exactly where they were. The X rather than a back arrow: this is a layer being closed, not a step of a journey being walked.
- **A picture pinch-zooms**, and the gallery's swipe carries over — the set is paged here exactly as it is in the card, **dots and all**: dots only, never arrows and never an "n of m". Arrows would be a second vocabulary for a gesture the reader already has; the count rides the dots' accessible name.
- A **video takes the full transport** (`VideoTransport`) — a feed card has only sound, because there it plays by being on screen. In the viewer the reader is deliberately watching. **Rotating the device fills the screen** with the clip; rotation is the device's own gesture, so there is no rotate control.
- **No acts, and no description.** No stance, no comments, no share: acting on a post happens where the post is. Alt text is read to people who cannot see the frame — printed under it, it becomes a caption the author never wrote.

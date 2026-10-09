`DetailClip` is the top of a video post's detail view — the clip above the card, at the head of the page's scroll.

```jsx
<DetailHeader items={READER_POST_MENU} />
<DetailColumn>
  <div style={{ display: "flex", flexDirection: "column" }}>
    <DetailClip item={clip} elapsed="0:14" duration="0:41" progress={0.34} />
    <PostCard {...post} variant="detail" />   {/* no media — the clip stands above */}
  </div>
</DetailColumn>
```

What holds:

- **It sits above the card, not inside it.** That is why the author chip leads the *card* on this surface rather than the screen: the content the reader is already watching sits above everything, and the card beneath is the post as it always reads. Pass the post **without** its media, and set the clip flush on the card — one block, no gap between them.
- **It is content: it scrolls with the page.** Render it inside the detail's scrolling column, never above it. Opening the detail starts it, whatever share of the screen it holds; the device's suppression (reduced motion, data saver) is the only thing that holds it back. Scrolled out of view it plays on, and no floating player takes its place.
- **It carries the full transport** — the ladder's second rung, because the reader opened this clip on purpose. The chrome auto-hides in the product; boards draw the revealed state.
- **The ground is black**, so a clip narrower than the frame sits on the same ground the viewer would give it.
- **The tap on it belongs to the surface**: back into the stream when the reader came from there, with their place held; the fullscreen viewer everywhere else.

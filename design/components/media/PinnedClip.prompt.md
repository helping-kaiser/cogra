`PinnedClip` is the top of a video post's detail view — the clip pinned above the card, still playing.

```jsx
<DetailHeader items={READER_POST_MENU} />
<PinnedClip item={clip} elapsed="0:14" duration="0:41" progress={0.34} />
<DetailColumn>
  <PostCard {...post} variant="detail" />   {/* no media — the clip is pinned above */}
</DetailColumn>
```

What holds:

- **It sits above the card, not inside it.** That is why the author chip leads the *card* on this surface rather than the screen: the content the reader is already watching sits above everything, and the card beneath is the post as it always reads. Pass the post **without** its media.
- **It carries the full transport** — the ladder's second rung, because the reader opened this clip on purpose. The chrome auto-hides in the product; boards draw the revealed state.
- **The ground is black**, so a clip narrower than the frame sits on the same ground the viewer would give it.
- **The tap on it belongs to the surface**: back into the stream when the reader came from there, with their place held; the fullscreen viewer everywhere else.

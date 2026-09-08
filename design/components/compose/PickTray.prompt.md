The band under the pick step's caption: what has been picked, the way to manage it, and the pictures themselves.

```jsx
<PickTray count={3} onShowAll={openSheet}>
  {picked.map((p) => <MediaThumb key={p.src} src={p.src} alt={p.alt} />)}
</PickTray>

<PickTray count={2} onShowAll={openSheet} caption="The first one is the cover.">
  <MediaThumb src="post-photo.jpg" cover/>
  <MediaThumb src="gallery-market.jpg" onRemove={remove}/>
</PickTray>

<PickTray count={1} caption="A video is the whole post. Its cover comes next.">
  <MediaThumb src="frame.jpg" width={114} height={64} video onRemove={remove} removeLabel="Remove this video"/>
</PickTray>
```

**The tray stops at its hairline.** What sits below it is the step's own — the device gallery on the phone, a dashed drop region on the web, an inert grid once a clip is staged, a list of refused files. Those are four different regions that happen to share a tray; do not push them into it.

**Pass the thumbnails as children.** Each board asks `MediaThumb` for something different — a cover badge, a remove X, a video frame at 114×64 with its own remove label — so the tray owns the band and the caller owns the pictures.

**Omit `onShowAll` when there is no set.** One staged video is not something to reorder and its cover is the next step's whole subject, so the tray drops Show all and the count sits alone on its line. `clip` is for the full batch, where ten tiles would otherwise push the band wider than the screen.

`Show all` is a real button — focusable, with the state layer and a 48px target — drawn as `InlineAction size="sm"`, which is its resting look value for value. Never redraw it as a span.

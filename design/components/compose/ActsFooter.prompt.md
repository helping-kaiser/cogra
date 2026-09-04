The one line that says how much a signature commits, where a full acts card would be too much.

```jsx
<div style={{ flex: 1 }}/>
<ActsFooter count={2}/>
<Button style={{ width: "100%" }}>Sign the edit</Button>
```

**`ActsCard` on a seal, `ActsFooter` on an edit.** A seal's whole subject is what is being signed, so it lists every act with its own count and the all-or-nothing subline. An edit's acts are the obvious consequence of what was just typed, so the same fact rides on one centred line with a chevron. The number must agree across both — an author who opens the card should read the count they already saw.

**It belongs to the button, not to the column.** The spacer above pushes the pair to the bottom; the footer then sits directly on the sign button with no gap, so the count is read on the way to the button rather than after it.

The chevron is drawn but not wired: whether it opens the acts card is unruled. When it is, the whole line becomes the target — a 16px glyph is not one.

Use `CitedSheet` as **the** manager of staged citations — the one surface behind a seal's "N cited" row.

```jsx
<CitedSheet
  open
  items={[
    { kind: "post", name: "The long way home — @ada", sub: "Post", src: "post-photo.jpg", pair: { pDirected: 0.1, pInterest: 0.1 }, onRemove: drop, onEdit: openPair },
    { kind: "person", name: "Mira Voss", sub: "Person", pair: { pDirected: 0.4, pInterest: 0.3 }, onRemove: drop, onEdit: openPair },
  ]}
  onClose={close}
/>
```

What holds:

- **It is where a count becomes a list.** A seal's References row names one staged citation and counts two or more ("3 cited"); the counting row is a door, and this is what it opens. A count with nothing behind it is a number the reader cannot check.
- **The rows are `StagedReference`, whole** — mark, name, sub-line, the signed pair, the ×, and the name that opens the pair. Two controls, two names ("Remove &lt;name&gt;", "&lt;name&gt; — set how it relates"), or a block of citations is a block of identically-named buttons.
- **It adds nothing.** No "+ Cite something": citations are staged at the stage that stages them — the post wizard's details step, the reply's own card — and `PickedSheet` manages a pick without offering another one for the same reason.
- Builds on `BottomSheet` (88% max height); the title carries the count, as the picked sheet's does, and `Done` is the only way out besides the scrim.

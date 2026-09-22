Use `TagsSheet` as **the** manager of staged tags — the one surface behind a seal's "N tags" row.

```jsx
<TagsSheet
  open
  items={[
    { topic: "fieldnotes", onRemove: drop, onEdit: openPair },
    { topic: "coastroad", onRemove: drop, onEdit: openPair },
    { topic: "saltmaps", onRemove: drop, onEdit: openPair },
  ]}
  onClose={close}
/>
```

What holds:

- **It is where a count becomes a list.** A seal's Tags row names the tags while they fit and counts them past that ("7 tags"); the counting row is a door, and this is what it opens. A count with nothing behind it is a number the reader cannot check.
- **It is `CitedSheet`'s twin on purpose.** Same shape, same title construction, same `Done`, because the seal's two counting rows are one grammar asked twice — a reader who has opened one knows what the other does.
- **The pills are `TopicRemovable`, whole** — the word, the pair where it deviates, the × named `Remove #&lt;topic&gt;`, and the pill that opens the pair. They sit in the composer's own wrapping row rather than one per line: a topic is a pill wherever the composer shows it.
- **It adds nothing.** No "+ Add a tag": tags are staged at the stage that stages them — the post wizard's details step, the reply's own card — and `CitedSheet` withholds "+ Cite something" for the same reason.
- Builds on `BottomSheet` (88% max height); the title carries the count, as the cited and picked sheets' do, and `Done` is the only way out besides the scrim.

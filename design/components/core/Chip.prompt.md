Use `Chip` for filters that combine — kinds of content, forms of post, what a feed also shows. Use `TopicChip` for a topic that opens.

```jsx
<Chip label="Comments" selected={kinds.includes("comments")} onToggle={() => toggle("comments")} />
<TopicChip topic="coastroads" />
```

- **Chips combine; a segmented filter chooses.** Seven kinds of ranked content, or an open list of topics, are chips. Two to four alternatives where exactly one is true are `SegmentedFilter`.
- **Selection is colour only** — `secondaryContainer`, no leading check glyph: a check would reflow every label in the row as the reader picks.
- 32px drawn, 48px tapped via `cg-hit`. A row of seven never grows past a thumb's reach.
- A chip is never the loudest thing on a screen: `primaryContainer` is not available to it.
- `TopicChip` is an anchor because it goes somewhere; `Chip` is a button because it acts. Do not swap them to get the look you want.

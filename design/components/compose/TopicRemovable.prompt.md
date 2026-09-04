A topic the author has staged, shown back to them.

```jsx
<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
  <TopicRemovable topic="fieldnotes"/>
  <TopicRemovable topic="coastroad"/>
  <Button variant="outline" size="sm">Add a topic</Button>
</div>
```

**Not a `Chip`.** A chip is something the reader presses to change what they are looking at — a filter, a readout. This is a piece of the thing being authored: the topic is already staged, and the only thing left to do with it is take it off. It keeps the `secondary-container` pair rather than borrowing the chip's, so the two never read as the same control.

**Pass the word, not the hash.** The author names a topic; the mark saying what kind of name it is belongs to the row showing it back.

The row it sits in is the composer's own — a wrapping flex row ending in the outline `Add a topic` button, under a field label.

The × is drawn but not wired, on every board that stages a topic — so the one action here has no keyboard path and no name. That is waiting on a ruling, the one `PickTray`'s "Show all" already got. When it lands, the × becomes the button; the pill must not, or removal becomes the only thing a topic is for.

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

**The × is the button, not the pill.** Making the pill pressable would say removal is the only thing a topic is for. The button adds no box — no border, no background, no padding, colour inherited — so it draws the glyph it always was, and brings the state layer, the focus ring and the 48px target with it. It names what it removes: `Remove #coastroad`, because a row of these is otherwise a row of identically-named controls.

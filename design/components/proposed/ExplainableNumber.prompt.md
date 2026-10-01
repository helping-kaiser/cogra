Use `ExplainableNumber` for any figure the product shows. It is the affordance, never the explanation.

```jsx
<ExplainableNumber glyph="graph" label="Post score" value="15.20" onOpenDetail={openScore} />
```

- **Every number is explainable** (§7). A figure with no route to what produced it is the black box again, just smaller — so `onOpenDetail` is not optional in spirit.
- **A glyph, not a word or an emoji.** The label goes in the accessibility tree. Emoji belong to the stance readout alone, and a glyph is what keeps the affordance row on one line.
- **The figure is drawn in both reading modes** (readme §13): geek mode governs the number PAIRS, and a score has no glyph that could carry its magnitude — a `graph` mark alone would say only that a score exists.
- **Negative is ordinary:** a minus sign, no colour. `error` is failure, and a low score is not one.
- Never a badge, a trend arrow, or a sparkline.
- **There is no expand-in-place variant**, and do not add one for a number that does not exist yet. The score's explanation is four screens (`FeedEntry` and below), whatever kind of card wears it; when a second figure arrives, design its explanation then.
- **One figure, two spoken names.** A post card's score is `Post score`; the feed's comment, person and tag cards say `Feed score`, because the rank is about the paths leading to a thing, not its kind.

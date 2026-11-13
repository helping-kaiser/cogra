Use `ExplainableNumber` for any figure the product shows. It is the affordance, never the explanation.

```jsx
<ExplainableNumber glyph="graph" label="Feed score" value="15.20" onOpenDetail={openScore} />
```

- **Every number is explainable** (§7). A figure with no route to what produced it is the black box again, just smaller — so `onOpenDetail` is not optional in spirit.
- **A glyph, not a word or an emoji.** The label goes in the accessibility tree. Emoji belong to the stance readout alone, and a glyph is what keeps the affordance row on one line.
- **The figure is drawn in both reading modes** (readme §13): geek mode governs the number PAIRS, and a score has no glyph that could carry its magnitude — a `graph` mark alone would say only that a score exists.
- **Negative is ordinary:** a minus sign, no colour. `error` is failure, and a low score is not one.
- **A tiny score never reads zero** (jakob 2026-11-12). The card prints two decimals, never more, and a score with 0 < |s| < 0.005 prints `0.01` or `−0.01`, so `0.00` is a severed one's alone; the trace prints the same figure in two significant digits, at most six decimals (`+0.0031`, `−0.00042`, `0.000001` the floor). A screen reader reads the printed figure. The whole rule is in `ExplainableNumber.jsx`.
- Never a badge, a trend arrow, or a sparkline.
- **There is no expand-in-place variant**, and do not add one for a number that does not exist yet. The score's explanation is four screens (`FeedEntry` and below), whatever kind of card wears it; when a second figure arrives, design its explanation then.
- **One figure, one name.** Every ranked card's score is `Feed score` — a post, a comment, a person, a tag and every kind to come — because the rank is about the paths leading to a thing, not its kind.

Use `ExplainableNumber` for any figure the product shows. It is the affordance, never the explanation.

```jsx
<ExplainableNumber glyph="graph" label="Post Score" value="15.20" onOpenDetail={openScore} />
```

- **Every number is explainable** (§7). A figure with no route to what produced it is the black box again, just smaller — so `onOpenDetail` is not optional in spirit.
- **A glyph, not a word or an emoji.** The label goes in the accessibility tree. Emoji belong to the stance readout alone, and a glyph is what keeps the affordance row on one line.
- **Negative is ordinary:** a minus sign, no colour. `error` is failure, and a low score is not one.
- Never a badge, a trend arrow, or a sparkline.
- **There is no expand-in-place variant**, and do not add one for a number that does not exist yet. The Post Score's explanation is four screens (`components/proposed/score/`); when a second figure arrives, design its explanation then.

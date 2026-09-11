A citation the author has committed to, held in the composer.

```jsx
<StagedReference kind="post" name="Tide tables and the third headland" sub="@juno" pair={{ pDirected: 0.4, pInterest: 0.1 }} onRemove={drop} onEdit={openPair}/>
<StagedReference kind="person" name="Ada Okonkwo" sub="@ada" src="ada.jpg" onRemove={drop}/>
```

**`StagedReference` in a composer, `ReferenceRow` on a reading surface.** The reading row is a way in: pressable, it navigates, no ×. This one navigates nowhere — the author is holding it, not following it.

**`onEdit` makes the row a button; the × stays its own.** What it opens is the stance pad in a sheet: a citation's two axes are both signed, so its pair is the pad's own shape, not a tag's pair of sliders. Two controls, two names — "Remove &lt;name&gt;" and "&lt;name&gt; — set how it relates" — or a block of citations is a block of identically-named buttons. Without `onEdit` the row is inert.

**The mark is `NodeMark`, so every kind arrives the same way**: a person as a circle, everything else as its tile. Citing a post and mentioning a person stage the same fact, and a row that drew them differently would deny it.

`pair` is what the act signs, trailing and quiet, and it arrives as numbers — the row formats it with `formatStancePair`, and the digits ride a `cg-exact` span that paints only in geek mode (readme §13). `sub` is the second line — whose it is, or what it is. Both are optional; a staged reference with neither is still a complete row.

A staged reference is an act, so it joins the acts card rather than sitting beside it: the total has to count it, or the count and the content disagree.

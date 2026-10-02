A citation the author has committed to, held in the composer.

```jsx
<StagedReference kind="post" name="Tide tables and the third headland" sub="@juno" pair={{ pDirected: 0.4, pInterest: 0.1 }} onRemove={drop} onEdit={openPair}/>
<StagedReference kind="person" name="Ada Okonkwo" sub="@ada" src="ada.jpg" onRemove={drop}/>
```

**`StagedReference` in a composer, `ReferenceRow` on a reading surface.** The reading row is a way in: pressable, it navigates, no ×. This one navigates nowhere — the author is holding it, not following it.

**`onEdit` makes the row a button; the × stays its own.** What it opens is `StancePad` in a sheet: a citation's two axes are both signed, so its pair is the pad's own shape, not a tag's pair of sliders. Two controls, two names — "Remove &lt;name&gt;" and "&lt;name&gt; — set how it relates" — or a block of citations is a block of identically-named buttons. Without `onEdit` the row is inert.

**The mark is `NodeMark`, so every kind arrives the same way**: a person as a circle, everything else as its tile. Citing a post and mentioning a person stage the same fact, and a row that drew them differently would deny it.

`pair` is what the act signs, trailing and quiet, and it arrives as numbers — the row formats it with `formatStancePair`, draws the nearest of the twenty `STANCE_ANCHORS` beside it, and the digits ride a `cg-exact` span that paints only in geek mode (readme §13). `sub` is the second line — whose it is, or what it is. Both are optional; a staged reference with neither is still a complete row.

`stance` says the pair is an opinion of its own — a kept pick in `KeptPicksReview` — so the spoken twin is `StanceReadout`'s, the anchor's word and both axes named; a citation's stays the bare pair. The drawing does not change.

A kept pick has two more row states. `removed` takes the target's removal mark (`Removed by its author`, `Deleted account`) when the target was removed or redacted while the pick waited: nothing leaves the graph, so the row stays and the pick still signs, wearing the removed-mark face — empty tile, the mark's line in the name's place in the system's voice. `consequence` takes the family's landing words (`This takes you back to zero.`) when the pick would net its bundle to nothing: said inline, the way `Remove citation` says its cost, with Sign as the confirmation and no dialog.

`untyped` is a citation this app cannot type, held on an edit as it is: api-spec excludes it from editing, so the row has no × and opens nothing. Its `name` is the target's standard summary line, as every picker row reads, and its `note` reads `Comes along as it is.` — no `sub`, no `pair`, since nothing about it is chosen here. It signs nothing, so no acts card counts it.

A staged reference is an act, so it joins the acts card rather than sitting beside it: the total has to count it, or the count and the content disagree.

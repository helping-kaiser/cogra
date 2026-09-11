Use `ReferenceRow` for every entry in the topics-and-references sheet, and for search results (backlog item 9) — one row shape across every node kind, so a heterogeneous list reads as one list.

```jsx
<ReferenceRow kind="person" name="Mira Voss" src="mira.jpg" pair={{ pDirected: 0.1, pInterest: 0.1 }} onOpen={open} />
<ReferenceRow kind="post" name="Salt maps of the coast road" src="cover.jpg" pair={{ pDirected: 0.55, pInterest: 0.2 }} onOpen={open} />
<ReferenceRow kind="topic" name="photography" pair={{ pDirected: 0.4, pInterest: 0.9 }} onOpen={open} />
<ReferenceRow kind="post" name="Grain of the flats" value="3d" onOpen={open} />   {/* an age is not a signal number */}
```

**The leading mark says the kind, without a word beside it**: a person keeps their avatar (a circle, as everywhere), a media post its cover, a text post the letter T as a tile, a topic its #, and the rest their node-type glyph — proposal `how_to_vote`, item `inventory_2`, campaign `campaign`, offer `sell`, chat `forum`, comment `chat_bubble`.

**The pair is the author's signed act, public record** — set at compose with a changeable default, shown right-aligned for any reader. Never coloured, never a judgement. **It arrives as numbers and the row formats it**: a `topic` row reads a tag's pair and wears the nearest of the thirteen `TAG_ANCHORS` beside it, every other kind reads a citation's and wears the nearest of the twenty `STANCE_ANCHORS`. Never hand-type the string — the row picks the glyph and the format from one value.

**The pair's digits are the geek reading** (readme §13): the anchor's glyph carries the row by default and the numbers ride a `cg-exact` span that paints only when the screen root says `data-geek="on"`. A `rank` keeps its number in both modes — geek governs the pairs, not every figure. `value` is the other edge entirely — a plain string, an age or a date, printed as given in both modes.

**`pending` is where a settling act is admitted, and the only place.** A chip on a card shows nothing pending — a tag's word is its word whether the record has been ordered or not — so this sheet carries the honesty. The marker stacks under the pair, not under the name: what has not landed is the act, not the node it points at.

```jsx
<ReferenceRow kind="topic" name="coastroad" pair={{ pDirected: 0.1, pInterest: 1 }} pending onOpen={open} />
```

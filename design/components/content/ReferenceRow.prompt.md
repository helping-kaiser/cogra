Use `ReferenceRow` for every entry in the topics-and-references sheet, and for search results (backlog item 9) — one row shape across every node kind, so a heterogeneous list reads as one list.

```jsx
<ReferenceRow kind="person" name="Mira Voss" src="mira.jpg" pair="+0.10 / +0.10" onOpen={open} />
<ReferenceRow kind="post" name="Salt maps of the coast road" src="cover.jpg" pair="+0.55 / +0.20" onOpen={open} />
<ReferenceRow kind="proposal" name="Mark the flooded dip" pair="+0.25 / +0.15" onOpen={open} />
```

**The leading mark says the kind, without a word beside it**: a person keeps their avatar (a circle, as everywhere), a media post its cover, a text post the letter T as a tile, a topic its #, and the rest their node-type glyph — proposal `how_to_vote`, item `inventory_2`, campaign `campaign`, offer `sell`, chat `forum`, comment `chat_bubble`.

**The pair is the author's signed act, public record** — set at compose with a changeable default, shown right-aligned for any reader. Never coloured, never a judgement.

Use `TaggedRow` for a row of a tag's page — the claim that put this content here, with the content's own card attached under it. Never draw the claim into the card: the card is `PostCard` or `CommentCard`, untouched, with `attach` set so it squares its top-left corner under the flag.

```jsx
<TaggedRow pair={{ pDirected: 0.4, pInterest: 0.9 }}>
  <PostCard attach {...post} />
</TaggedRow>
```

**The pair arrives as numbers, never as a string.** The row reads the nearest of the thirteen `TAG_ANCHORS` and formats the value with `formatTagPair`, so the glyph and the numbers always describe the same claim and no screen hand-types a format the contract does not use.

**The glyph carries the reading; the numbers are the geek one.** `🔍 Tagged` is the default flag; the exact `+0.40 / 0.90` rides a `cg-exact` span beside it and paints only when the screen root carries `data-geek="on"` (readme §13). The spoken reading is one screen-reader-only span, the same in both modes — an emoji's own accessible name is "magnifying glass tilted left", not "had to look, but it's in there".

**"Tagged" needs no tag name beside it.** The page is titled by the tag; the word says which act the glyph and the numbers belong to. A claim still settling adds `pending`.

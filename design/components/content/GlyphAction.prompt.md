`GlyphAction` is a feed card's own act, drawn as a glyph in the card's row.

```jsx
<CommentCard {...comment} replyGlyph onReply={openThreadAtComment} />       // the comment glyph
<PostCard lead={tagLead} main={glimpse} act={<GlyphAction glyph="add" label="Tag a new post with it" onPress={compose} />} />
```

What holds:

- **The row is unified.** Every feed card reads opinion · score · the kind's own act · share. A post's own act is its comments, which `PostCard` draws with their count; every other kind's act is this.
- **One anatomy with its neighbours.** 18px glyph, `text-secondary`, a 48px target, the share button's padding — so a row of four never reads as two kinds of control.
- **The words are the accessible name.** A glyph keeps the row on one line; the act is spoken in full.

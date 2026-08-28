Use `TopicsLine` for the topics-and-citations line on any content card — `PostCard` and `CommentCard` already render it; never rebuild the chips row inline.

```jsx
<TopicsLine topics={post.topics} references={post.references} onOpenReferences={openSheet} />  {/* feed */}
<TopicsLine topics={post.topics} references={post.references} onOpen={openSheet} />            {/* detail */}
```

**At most two chips, then the counts in words**: `#coastroad #saltmarsh · 23 topics · 3 references`. A clipped parade of half-chips says nothing; the counts are the readable fact and the way in — they open the topics-and-references sheet (`ReferenceRow` rows), which is the full set's home. One line on every variant, never a wrap or second row (readme §13's collapse order). References are never listed inline on the card.

Two tap models, never mixed: in a feed the chips navigate to their topics and the counts open the sheet; on a detail surface pass `onOpen` and the whole line is one control opening the sheet (the chips render inert inside it).

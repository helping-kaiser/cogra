Use `TopicsLine` for the topics-and-citations line on any content card — `PostCard` and `CommentCard` already render it; never rebuild the chips row inline.

```jsx
<TopicsLine topics={post.topics} references={post.references} onOpenReferences={openSheet} />
<TopicsLine topics={post.topics} references={post.references} wrap />   {/* detail */}
```

**One line, clipped, in a summary card** — readme §13's collapse order: this line gives way before media or the affordance row ever shrink. `wrap` is the detail variant's full set. The citation count rides the end of the same line and opens the topics-and-references sheet (`ReferenceRow` rows); references are never listed inline on the card.

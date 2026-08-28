Use `TopicsLine` for the topics-and-citations line on any content card — `PostCard` and `CommentCard` already render it; never rebuild the chips row inline.

```jsx
<TopicsLine topics={post.topics} references={post.references} onOpenReferences={openSheet} />  {/* feed */}
<TopicsLine topics={post.topics} references={post.references} onOpen={openSheet} />            {/* detail */}
```

**One line, clipped, on every variant** — readme §13's collapse order: this line gives way before media or the affordance row ever shrink, and the topics-and-references sheet (`ReferenceRow` rows) is the full set's home. References are never listed inline on the card.

Two tap models, never mixed: in a feed the chips navigate to their topics and only the count opens the sheet; on a detail surface pass `onOpen` and the whole line is one control opening the sheet (the chips render inert inside it) — fifty chips are fifty reasons not to make each its own target there.

`ShareButton` hands a post to the platform's own share sheet.

```jsx
<PostCard {...post} variant="detail" actions={<ShareButton />} />
```

It rides the affordance row through `PostCard`'s `actions` slot, after the stance, the score and the comment count — the row stays one line, and share is the last thing to arrive on it.

What holds:

- **The sheet is the OS's.** One tap and the handoff is done. A share menu drawn here would be a worse copy of the platform's, and it would know nothing about the reader's own apps and contacts.
- **A glyph, never a count.** Every other affordance in the row is glyph-plus-number because the number is a fact the graph holds. Sharing leaves no record, so a number here would be invented.
- **Where it is drawn**: the post detail view and the stream's rail. A **feed card** does not carry it yet — that question is open (backlog item 33), and the row there is already at its width.

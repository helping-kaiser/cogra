`ShareButton` hands a post to the platform's own share sheet.

```jsx
// PostCard draws it — every card, every surface
<PostCard {...post} />
<PostCard {...post} showShare={false} />   // only where there is nothing to share
```

What holds:

- **The sheet is the OS's.** One tap and the handoff is done. A share menu drawn here would be a worse copy of the platform's, and it would know nothing about the reader's own apps and contacts.
- **A glyph, never a count.** Every other affordance in the row is glyph-plus-number because the number is a fact the graph holds. Sharing leaves no record, so a number here would be invented.
- **It is last, and that is the rule.** The row reads stance · score · comment · share — its order of importance and its queue both. On a phone too narrow to hold all four, share is the first to move into the ⋮ menu, and the row gives way from its end. Anything added later is ranked against what is already reachable before it earns a slot.
- **Where it is drawn**: every post card, the detail view, and the stream's rail.

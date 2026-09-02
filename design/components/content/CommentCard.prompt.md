Use `CommentCard` for every comment and reply. It renders an `<li>` and recurses through `replies`, so a thread is one call. Comments live in the **comments sheet** (readme §13, 2026-08-28) — a near-full-height `BottomSheet` with a pinned entry row — never in the post's detail view.

```jsx
<ul style={{ display: "flex", flexDirection: "column", gap: 12, margin: 0, padding: 0 }}>
  {comments.map((c) => (
    <CommentCard key={c.id} {...c} onReply={() => reply(c.id)} own={c.author.handle === me}>
      {replyingTo === c.id && <ReplyComposer />}
    </CommentCard>
  ))}
</ul>
```

The thread is **two levels deep on screen**: a comment, and its replies indented 12px once. A reply to a reply flattens into the same level and opens with the @handle it answers — the mention is the structure, rendered in `primary`. Replies arrive **collapsed**: pass `replyCount` for the "View n replies" line, `replies` once expanded. `Reply` and `Edit` are text buttons and appear only for a signed-in reader (`Edit` only on their own comment). An open composer goes in `children` so it sits between the comment and its replies, where the reader expects it.

The stance control, `Reply`, `Edit`, and anything passed as `actions` share **one affordance row** — the same row `PostCard` uses, in the same order, so a comment and a post read the same way.

**A comment is words first and its pictures join them** (readme §13): pass `media` and the pictures render below the words, INSET at the card's medium rung — an attachment, not the body, so no full-bleed. Comment pictures are never cropped (2026-08-31); multiples ride the same `MediaGallery` pager as a post's, in a fixed square frame each whole frame fits inside (pass each item `fit: "contain"` and its true ratio). At most **four** per comment — an authoring-side cap, like the post's ten.

**`sensitive` veils the whole body as one comment-scale block** — words and pictures together, replaced rather than covered, since a comment is too short to wash in place twice over. The author, timestamp, topics and stance control stay readable: that frame is the comment's answer to a post's title staying outside the veil. The block names its `source` — `"author"` for the author's own warning, `"platform"` for a verdict — with `reason` after it.

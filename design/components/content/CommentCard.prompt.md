Use `CommentCard` for every comment and reply. It renders an `<li>` and recurses through `replies`, so a thread is one call.

```jsx
<ul style={{ display: "flex", flexDirection: "column", gap: 12, margin: 0, padding: 0 }}>
  {comments.map((c) => (
    <CommentCard key={c.id} {...c} onReply={() => reply(c.id)} own={c.author.handle === me}>
      {replyingTo === c.id && <ReplyComposer />}
    </CommentCard>
  ))}
</ul>
```

Indentation is 12px per level and stops at three; past that the thread flattens. `Reply` and `Edit` are text buttons and appear only for a signed-in reader (`Edit` only on their own comment). An open composer goes in `children` so it sits between the comment and its replies, where the reader expects it.

The stance control, `Reply`, `Edit`, and anything passed as `actions` share **one affordance row** — the same row `PostCard` uses, in the same order, so a comment and a post read the same way.

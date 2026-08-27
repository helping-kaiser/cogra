Use `PendingMarker` under any content whose signed record has not yet landed, and `EditedMarker` under content whose `updatedAt` is later than its `createdAt`.

```jsx
<p className="text-body-medium">{comment.content}</p>
{edited && <EditedMarker />}
{pending && <PendingMarker />}
```

Both are `label-small` on `--text-secondary` and **never** `error` colouring — pending content is real content, and an edit is not a fault. Never grey out, hide, or hold back pending content: it renders in full for every reader, author or not. `Removed` and `Sensitive` (design.md §9) are specified but not built; do not improvise them.

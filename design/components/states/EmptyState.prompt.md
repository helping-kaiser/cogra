Every list surface needs all three states. Use `EmptyState` and `LoadingState` here, and `TransportError` + a `Retry` button for the third.

```jsx
{loading && <LoadingState />}
{!loading && posts.length === 0 && (
  <EmptyState title="Nothing here yet — write the first post." actionLabel="New post" onAction={compose} />
)}
```

Copy rules: state the fact, offer the one action that changes it, and stop. `Nothing here yet.` on a profile chronicle, `No comments yet.` on a thread, `Checking where you stand…` while a standing loads. Never "You haven't posted anything!", never a call to action for something the reader cannot do here, never `error` colour — an empty list is not a fault.

Loading is a line of text on `onSurfaceVariant`, not a spinner and not a shimmering skeleton: motion never performs, and a skeleton pretending to be content is the opposite of the honesty surfaces.

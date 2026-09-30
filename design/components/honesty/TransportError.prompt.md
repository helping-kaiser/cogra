Use `TransportError` for a read or write that never reached the server, and `SigningPending` when a signing pass did not complete.

```jsx
{fault === "refresh" && (
  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
    <TransportError message={posts.length ? "Can't reach the server — new posts can't load right now." : undefined} />
    <Button variant="outline" size="sm" onClick={retry}>Retry</Button>
  </div>
)}
```

`SigningPending row` is the line a target's row carries when a press-and-hold did not sign — the gesture has no surface of its own to re-raise, so the fault stands under the face, in the pending marker's slot: `That didn't sign.` in `label-small` failure ink, `Retry` as the bare word ending the line. While the hold is still signing (past 200ms) the same slot carries `PendingMarker label="Signing…"`, quiet. Where retrying cannot change the answer (the write rule) pass `message="You can't sign right now."` and no `onRetry`.

Always pair a fault with a `Retry` control, and put the fault **where the fetch was requested**: a failed refresh above the content, a failed page fetch in place of `Load more`. Content already on screen stays readable underneath. These are the only two places in the product where `error` colour appears alongside body copy.

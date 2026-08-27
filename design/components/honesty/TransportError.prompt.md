Use `TransportError` for a read or write that never reached the server, and `SigningPending` when a signing pass did not complete.

```jsx
{fault === "refresh" && (
  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
    <TransportError message={posts.length ? "Can't reach the server — new posts can't load right now." : undefined} />
    <Button variant="outline" size="sm" onClick={retry}>Retry</Button>
  </div>
)}
```

Always pair a fault with a `Retry` control, and put the fault **where the fetch was requested**: a failed refresh above the content, a failed page fetch in place of `Load more`. Content already on screen stays readable underneath. These are the only two places in the product where `error` colour appears alongside body copy.

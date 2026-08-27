Use `RecoveryCode` on the key ceremony and key-backup surfaces — anywhere a string is shown once and must leave the screen with the reader. Place it inside a `Card`; it draws no box of its own.

```jsx
<Card>
  <h2 className="text-title-medium">Write this down</h2>
  <RecoveryCode
    code="K7QF-2M9X-4TVB-8RJD"
    explainer="This is the only way to restore your key. We can't show it again."
    onConfirmed={dismiss}
  />
</Card>
```

The confirm button stays disabled until the code is typed or pasted back. The code is `title-large` in the platform monospace with wider tracking — the biggest thing on its surface, and the one place monospace is allowed.

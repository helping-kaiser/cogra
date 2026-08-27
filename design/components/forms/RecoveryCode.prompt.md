Use `RecoveryCode` on the key ceremony and key-backup surfaces — anywhere a string is shown once and must leave the screen with the reader. Place it inside a `Card`; it draws no box of its own.

```jsx
<Card>
  <h2 className="text-title-medium">Write this down</h2>
  <RecoveryCode
    code="7Q3ZD-XK9P2-M4TVE-0RH8N-1WYB6C"
    explainer="This is the only way to restore your key. We can't show it again."
    onConfirmed={dismiss}
  />
</Card>
```

The confirm button stays disabled until the code is typed or pasted back. The code is `body-large` in the platform monospace with wider tracking — the one place monospace is allowed. A real code is 26 Crockford characters in 5-5-5-5-6 groups, and the size is chosen so that grouping holds one line inside a card at mobile width. The surface it sits on is a trap by design: no back affordance, gated on entry by a think-twice dialog, left only through the typed-back confirmation (readme §13).

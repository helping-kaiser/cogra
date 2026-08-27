Use `Snackbar` to confirm a completed action — a signed write, a saved edit. Fire it once per event; never for errors (those sit on the surface they happened on) and never for progress.

```jsx
<Snackbar message={signed} onDismiss={() => setSigned(null)} />
```

It rides `inverseSurface`/`inverseOnSurface` — tonal elevation, never a drop shadow — at the 4px radius rung, and clears itself after 4s. It sits 80px off the bottom to clear the bar on a read surface — pass `offset={16}` on a task flow, which has no bar. Copy says what happened, in the past tense: `Signed, still settling. Where you stand now: How you stand +0.10, In your world +0.10`.

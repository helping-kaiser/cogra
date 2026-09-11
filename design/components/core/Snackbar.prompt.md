Use `Snackbar` to confirm a completed action — a signed write, a saved edit. Fire it once per event; never for errors (those sit on the surface they happened on) and never for progress.

```jsx
<Snackbar message={signed} onDismiss={() => setSigned(null)} />
<Snackbar message="@ada is hidden — their posts stay out of your feed." action="Undo" onAction={unhide} />
```

**One action at most, and only where a way back is worth offering.** `action` draws a word — never a pill — on the message's own line, in `--action-on-snackbar`. Hiding someone takes `Undo`; a confirmation of something cheap to repeat takes none, and so does an act whose undo would be worse than living with it (the canceled deletion).

It rides `inverseSurface`/`inverseOnSurface` — tonal elevation, never a drop shadow — at the 4px radius rung, and clears itself after 4s. It sits 80px off the bottom to clear the bar on a read surface — pass `offset={16}` on a task flow, which has no bar. Copy says what happened, in the past tense: `Signed, still settling. Current opinion 🙂 (+0.55 / +0.20)`.

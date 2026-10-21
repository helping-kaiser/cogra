`EmptySignConfirm` asks before a pick that says nothing is signed: Set on a pick whose landing is exactly (0, 0) **while nothing stands** toward the target — no record ever signed, or a bundle already walked back to nothing (jakob 2026-10-21). It is never `SeveranceConfirm`: there is nothing to walk back, and the record leaves the standing as it was. It asks and never blocks — `Set it anyway` is always one tap away.

```jsx
<EmptySignConfirm targetLabel="@ada" onConfirm={sign} onCancel={backToThePad} />
```

The words are fixed: `Sign an empty opinion?` · `This says nothing about @ada, shapes no feed, and leaves you where you are.` · `It signs 1 thing, paid on its own.` · `Set it anyway` / `Keep it`. The target is the pad's own `targetLabel`.

**`SeveranceConfirm`'s shape**: the safe action, `Keep it`, filled in the right-hand slot; the act a text button on the left; no `error` colour; the pad stays parked beneath, so `Keep it`, the scrim, Escape and Back return to the pick as it was. `StanceControl` raises it on its own — reach for the component directly only to draw the moment.

**The signing waits, and says so.** `busy` swaps the act to `Setting…` and makes it inert, never dimmed, and the ways out wait with it; `failed` keeps the dialog up with `That didn't send. Try again.` and the act's slot reads `Retry`.

`StanceCoachMark` appears exactly once per reader, on their first tap of any stance target — and that tap signs nothing.

```jsx
{coach && <StanceCoachMark onDismiss={() => setCoach(false)} />}
```

Its first line must stay `Nothing was signed just now.` — the whole point is to stop a reader from tapping again and paying for it. Non-modal: no scrim, nothing trapped, no timer. It is anchored to the target, overlapping nothing, and stays until dismissed or until the first successful hold.

**The pad's `?` is the other half.** It opens `STANCE_PAD_HELP` — four lines covering what the field means, what commits, why `Your pick` and `Resulting stance` are different numbers, and what severing costs — and it **replaces the pad's body** rather than growing below it. The pad is parked at one fixed spot and operated by muscle memory; a panel that pushes `Set` further from the thumb every time it opens defeats the parking. `Set` is disabled while the help is showing, so the panel can never be signed through by accident, and `Back to the pad` returns.

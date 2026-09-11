`StanceCoachMark` appears exactly once per reader, inside the pad on their first open of it.

```jsx
{coach && <StanceCoachMark onDismiss={() => setCoach(false)} />}
```

What it teaches is the **shortcut**: the tap has already brought the reader to the pad, so the only thing left to say is that the same button, held, signs the gentle default without opening anything. Non-modal: no scrim, nothing trapped, no timer. It sits above the field — the pad is parked by its bottom edge, so the note grows upward and leaves `Set` and `Cancel` where the thumb expects them — and stays until dismissed or until the pad closes.

**The pad's `?` is the other half.** It opens `STANCE_PAD_HELP` — four lines covering what the field means, what commits, why `Your pick` and `Resulting opinion` wear different faces, and what walking it back costs — and it **replaces the pad's body** rather than growing below it. The pad is parked at one fixed spot and operated by muscle memory; a panel that pushes `Set` further from the thumb every time it opens defeats the parking. `Set` is disabled while the help is showing, so the panel can never be signed through by accident, and `Back to the pad` returns.

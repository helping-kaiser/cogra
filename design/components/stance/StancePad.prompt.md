`StancePad` is the field on its own — use it when a design needs to show the bloomed pad without driving the whole gesture (a spec sheet, an onboarding illustration, a static mock).

```jsx
<StancePad value={{ pDirected: 0.4, pInterest: 0.2 }} />
<StancePad value={pick} onChange={setPick} />
```

The field is `surfaceContainerHighest` at the **large (16px)** rung; the knob is 20px of `primaryContainer` — the loudest surface, which belongs to a committed stance. The centre-lines are `outlineVariant` hairlines and must stay visible: they are drawn dead ground, not decoration. Never clamp by radius — each axis clamps on its own, so all four corners are reachable.

For the real interaction use `StanceControl`, which owns the tap, the hold, the parking, and the confirmations.

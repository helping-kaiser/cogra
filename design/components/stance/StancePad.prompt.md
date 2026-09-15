`StancePad` is the field on its own — use it when a design needs to show the bloomed pad without driving the whole gesture (a spec sheet, an onboarding illustration, a static mock).

```jsx
<StancePad value={{ pDirected: 0.4, pInterest: 0.2 }} />
<StancePad value={pick} onChange={setPick} />
```

The field is `surfaceContainerHighest` at the **large (16px)** rung; the knob is 20px of `primaryContainer` — the loudest surface, which belongs to a committed opinion. The centre-lines are `outlineVariant` hairlines and must stay visible: they are drawn dead ground, not decoration. Never clamp by radius — each axis clamps on its own, so all four corners are reachable.

**The four pole words sit OUTSIDE the field, in gutters the component reserves** (jakob's ruling 2026-09-15). Nothing but dead ground and the knob is drawn inside the field: the knob travels every point the field has, so a word placed in there is a word the knob eventually covers — at the top pole it disappeared under the disc entirely. Size the whole assembly, not the square: the component is `width: 100%` and the field takes what the gutters leave, so a caller passing a fixed width shrinks the field rather than the ring. A one-axis field drawn by hand (`ComposePad`) follows the same rule.

For the real interaction use `StanceControl`, which owns the tap, the hold, the parking, and the confirmations.

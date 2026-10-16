`StancePad` is the field on its own — use it when a design needs to show the bloomed pad without driving the whole gesture (a spec sheet, an onboarding illustration, a static mock).

```jsx
<StancePad value={{ pDirected: 0.4, pInterest: 0.2 }} />
<StancePad value={pick} onChange={setPick} />
```

The field is `surfaceContainerHighest` at the **large (16px)** rung; the knob is 20px of `primaryContainer` — the loudest surface, which belongs to a committed opinion. The centre-lines are `outlineVariant` hairlines and must stay visible: they are drawn dead ground, not decoration. Never clamp by radius — each axis clamps on its own, so all four corners are reachable.

**The four pole words sit OUTSIDE the field, in gutters the component reserves** (jakob's ruling 2026-09-15). Nothing but dead ground and the knob is drawn inside the field: the knob travels every point the field has, so a word placed in there is a word the knob eventually covers — at the top pole it disappeared under the disc entirely. Size the whole assembly, not the square: the component is `width: 100%` and the field takes what the gutters leave, so a caller passing a fixed width shrinks the field rather than the ring.

**`AttachmentPad` is the same field cut to one axis** — the pad an author meets when they sign their own content (jakob 2026-10-16, PR-101). Publish and Owner are single-parameter families: the attachment rides `p_d` and the census pins `p_i` at 1, so the value is one number and the field is a 56px strip, as wide as the square would be. Same surface, rung, knob, pressed layer and gutters; one dead-ground hairline, at zero, and only `Against` · `For` outside it. Never draw the square where the record has one free parameter, and never draw the strip where it has two.

```jsx
<AttachmentPad value={0.1} />
<AttachmentPad value={a} onChange={setA} />
```

For the real interaction use `StanceControl`, which owns the tap, the hold, the parking, and the confirmations.

**In a sheet, the field owns every pointer that starts on it** (readme §4, *Sheets*). A drag that begins on the field moves the knob and never the sheet; the sheet drags only from its handle and title zone. `touchAction: none` says this on the web; on Android the field consumes the drag before the sheet's own drag handling sees it. A swipe down, Back and Escape leave the sheet the way its scrim does — the pair is what it was.

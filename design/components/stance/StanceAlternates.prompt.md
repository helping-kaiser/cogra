Use `StanceAlternates` for the non-drag route to giving an opinion. `StanceControl` opens it from `Choose your opinion` — in the DOM beside every stance target, visually hidden until focused, and it also replaces the pad entirely for a reader who has chosen sliders or direct entry in settings.

```jsx
<StanceAlternates
  pick={pick} onPick={setPick}
  onCommit={sign} onCancel={close} onSever={openSeverance}
  landing={<StanceLandingLine landing={landing} />}
>
  <StanceStanding pick={pick} bundle={bundle} targetLabel="this post" />
</StanceAlternates>
```

It must offer the **full** range, not a coarse subset — a degraded alternate is not an accessible path. Keep the current opinion above and the landing below, same order as the pad. The affirmative action reads `Sign it`.

**One control at a time.** Sliders lead; `Type exact values` swaps to the typed fields and back. Never render both at once — two controls editing the same two numbers is a needless choice at the moment of a priced act. `mode="entry"` opens on the typed fields for a reader who has chosen them in settings.

**A family that is not an opinion hosts it in its own sheet** (audit K10.1). The tag and citation pair sheets carry a visually-hidden-until-focused `Set exact values for <name>` control that swaps the field for `host="sheet"` — the readouts, the two tracks, their swap and the landing, in the field's place; the sheet keeps its title, `Done` and scrim. Pass the family's `axes` (its own track names and poles) and `ranges` (`TAG_RANGES` for a tag); hand no `onSever`, because the sheet's withdrawal is its own control. At `host="dialog"` a non-opinion caller passes `title` and `commitLabel` instead of the opinion's.

```jsx
<StanceAlternates host="sheet" pick={pair} onPick={setPair} axes={TAG_AXES} ranges={TAG_RANGES}>
  {readout}
</StanceAlternates>
```

**The "?" names its own pad** (jakob's ruling A7) — `helpLabel`, defaulting to `"How opinions work"`. A board that draws a named pad passes that pad's own title (`"Your opinion on your post"`, `"Toward what you answer"`, `"Your first opinion"`); it mirrors whatever `helpLabel` `StanceControl` was given.

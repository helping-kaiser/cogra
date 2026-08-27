Use `StanceAlternates` for the non-drag route to a stance. `StanceControl` opens it from `Choose your stance` — in the DOM beside every stance target, visually hidden until focused, and it also replaces the pad entirely for a reader who has chosen sliders or direct entry in settings.

```jsx
<StanceAlternates
  pick={pick} onPick={setPick}
  onCommit={sign} onCancel={close} onSever={openSeverance}
  landing={<StanceLandingLine landing={landing} />}
>
  <StanceStanding pick={pick} bundle={bundle} targetLabel="this post" />
</StanceAlternates>
```

It must offer the **full** range, not a coarse subset — a degraded alternate is not an accessible path. Keep the standing above and the landing below, same order as the pad. The affirmative action reads `Sign it`.

**One control at a time.** Sliders lead; `Type exact values` swaps to the typed fields and back. Never render both at once — two controls editing the same two numbers is a needless choice at the moment of a priced act. `mode="entry"` opens on the typed fields for a reader who has chosen them in settings.

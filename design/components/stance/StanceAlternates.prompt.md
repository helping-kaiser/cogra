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

**The commit waits as Set does** (seam 245, ask 14). `StanceControl` hands its `signing` on while the alternates are up: `busy` reads `Signing…` and goes inert, never dimmed; `failed` keeps the dialog at the pick with `That didn't send. Try again.` above the action row and `Retry`, outlined, in `Sign it`'s slot; `writeRule` puts the pad's notice — `You can't sign right now`, its fact, its own "?" — where the landing line and the action row were, with `Not now` under it and no Retry; `keyAbsent` carries `PadKeyAbsent`'s notice in the same place — `Your key isn't on this browser`, its two lines, `Restore the key` — with `Keep it pending, restore later` under it, and no Cancel, commit or walk-back (seam 248). Cancel stays live while it signs and closes the dialog, never the act: the wait passes to the target's row.

**A typed value clamps as the pad clamps.** The field keeps what was typed while the reader types; the pick takes the nearest value the bound allows (`1.5` signs `+1.00`), and the readout above says so before anything is signed — no refusal line. A field that does not parse (emptied, a lone minus) moves nothing; leaving it rewrites it to the pick's value. `typed` draws a field mid-typing on a board.

**One control at a time.** Sliders lead; `Type exact values` swaps to the typed fields and back. Never render both at once — two controls editing the same two numbers is a needless choice at the moment of a priced act. `mode="entry"` opens on the typed fields for a reader who has chosen them in settings.

**A family that is not an opinion hosts it in its own sheet** (audit K10.1). The tag and citation pair sheets carry a visually-hidden-until-focused `Set exact values for <name>` control that swaps the field for `host="sheet"` — the readouts, the two tracks, their swap and the landing, in the field's place; the sheet keeps its title, `Done` and scrim. Pass the family's `axes` (its own track names and poles) and `ranges` (`TAG_RANGES` for a tag); hand no `onSever`, because the sheet's withdrawal is its own control. At `host="dialog"` a non-opinion caller passes `title` and `commitLabel` instead of the opinion's.

```jsx
<StanceAlternates host="sheet" pick={pair} onPick={setPair} axes={TAG_AXES} ranges={TAG_RANGES}>
  {readout}
</StanceAlternates>
```

**One axis takes one control** (jakob 2026-10-20). The input chosen in settings governs everywhere, the backing pads included. Where the record has one free parameter — the backing on one's own content, its second number pinned at 1 by the census — pass `axis="one"`: one track, or one typed field, over `For or against`, with `Type an exact value` / `Use a slider` as the swap. Never a second, locked track for the pinned number: a control nobody can move is a choice the record does not have. On the backing pads it hosts in place at `host="sheet"`, the `TagPad` pattern, behind the hidden-until-focused `Set an exact value for your backing`.

```jsx
<StanceAlternates host="sheet" axis="one" pick={{ pDirected: 0.1, pInterest: 1 }} onPick={setPick} />
```

**The "?" names its own pad** (jakob's ruling A7) — `helpLabel`, defaulting to `"How opinions work"`. A board that draws a named pad passes that pad's own title (`"Your backing on your post"`, `"Toward what you answer"`, `"Your vouch back"`); it mirrors whatever `helpLabel` `StanceControl` was given.

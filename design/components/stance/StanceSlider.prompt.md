Use `StanceSlider` for one axis of a stance, in pairs.

```jsx
<StanceSlider label={DIRECTED_LABEL} value={pick.pDirected} onChange={(pDirected) => setPick({ ...pick, pDirected })} />
<StanceSlider label={INTEREST_LABEL} value={pick.pInterest} onChange={(pInterest) => setPick({ ...pick, pInterest })} />
```

Range `[-1, +1]`, step `0.01`, and the signed two-decimal value lives **in the label** so it is the accessible name. Labels are always the reader's words: `For or against`, `How much reaches you` — and the ends are named too (`Against`/`For`, `Less`/`More`), because a track from −1 to +1 says nothing about which end is which.

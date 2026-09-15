Use `StanceSlider` for one axis of a stance, in pairs.

```jsx
<StanceSlider label={axes.directed} minLabel={axes.left} maxLabel={axes.right} value={pick.pDirected} onChange={(pDirected) => setPick({ ...pick, pDirected })} />
<StanceSlider label={axes.interest} minLabel={axes.bottom} maxLabel={axes.top} value={pick.pInterest} onChange={(pInterest) => setPick({ ...pick, pInterest })} />
```

Range `[-1, +1]`, step `0.01`, and the signed two-decimal value lives **in the label**, in a `cg-exact` span that paints only in geek mode (readme §13) — the range input announces its own value either way. Labels are always the reader's words, and they come from the record family's own `axes` object rather than from this control: a stance's are `For or against` and `How much reaches you`, an Affinity's `How much you like it` and `How close you want to be`. The ends are named too (`Against`/`For`, `Less`/`More`), because a track from −1 to +1 says nothing about which end is which.

`SeveranceConfirm` is the only gate in the stance flow, and it **confirms rather than refuses**. It opens both when the reader deliberately severs and when an ordinary pick happens to net their standing to (0, 0).

```jsx
<SeveranceConfirm
  pick={pick} targetLabel="@ada" bundle={bundle} records={3}
  onConfirm={sever} onCancel={close}
/>
```

Keep the fixed order: title, the pick line (only when reached by a pick), the consequences, **the raw total** ("everything you've said adds up to …"), the cap as an aside *only when the sum exceeded it*, the cost in signed actions, then `Sever` / `Keep it`. The total leads and the cap is derived from it — stated the other way round it reads as broken arithmetic. Never `error` colouring — severance is a legitimate choice, not a failure. Never block the corner of the field to prevent it.

**The destructive-dialog rule** (a divergence from the source, applied to every destructive dialog from here on): the **safe** action is the filled one and keeps the right-hand slot; the destructive action is a text button on the left. Two equal-weight text buttons are a coin flip when one of them is irreversible.

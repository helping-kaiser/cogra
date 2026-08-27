Use `Checkbox` for a binary opt-in that is not an action — "Don't remember this account on this device" on the sign-in and restore screens is the canonical use. It is not a filter (that is `Chip`), and not a pick between alternatives (that is `SegmentedFilter`).

```jsx
<Checkbox
  label="Don't remember this account on this device"
  checked={forget}
  onChange={setForget}
/>
```

The 18px box sits on the extra-small rung with the system's 1px hairline — M3 draws a 2px checkbox border, and §4 rules that nothing carries one. Checked fills `primary` with the inlined `check` glyph, so the state is never colour alone. The row is the control: label included, 48px tall, one tap anywhere on it.

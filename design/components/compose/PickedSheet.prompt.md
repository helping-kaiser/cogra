Use `PickedSheet` as **the** per-picture manager — opened by the pick step's "Show all" and by `PickedRow` everywhere else. Order, cover, remove, and describe live here and nowhere else.

```jsx
<PickedSheet
  open
  items={[
    { src: a, described: true },            // row 1 is "Cover — shown first"
    { src: b, onDescribe: open, onRemove: rm },
    { src: c, onDescribe: open, onRemove: rm },
  ]}
  onClose={close}
/>
```

What holds:

- **The first one is the cover, and the badge travels with reorder.** There is no separate cover control; drag by the handle.
- A described picture shows the quiet word "Described"; an undescribed one shows the primary "Describe" link into `DescribeSheet`.
- Builds on `BottomSheet` (88% max height). The caption under the rows says the one rule: "The first one is the cover — drag to reorder."

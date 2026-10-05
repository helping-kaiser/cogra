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

- **The first one is the cover, and the badge travels with reorder.** Drag by the handle, or use the row's own moves.
- **The drag has non-drag twins** (the K13 round; drawn 2026-10-05): after `Describe`, the row's second line carries `Make it the cover` · `Move up` · `Move down` as small inline actions, each row only the moves it can make — the cover has no `Make it the cover` and no `Move up`, the last row no `Move down`. Pass `onMakeCover`, `onMoveUp`, `onMoveDown` per item. The handle is focusable (`Reorder the cover`, `Reorder picture 2`) and ↑ / ↓ move the focused row.
- A described picture shows the quiet word "Described"; an undescribed one shows the primary "Describe" link into `DescribeSheet`.
- Builds on `BottomSheet` (88% max height). The caption under the rows says the one rule: "The first one is the cover."

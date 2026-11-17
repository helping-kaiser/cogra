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
- **The drag has non-drag twins** (the K13 round; jakob 2026-11-17, "as rec (b)"): after `Describe`, every row but the cover carries `Make it the cover` as a small inline action — the tap twin, every order reachable by taps alone. The handle is focusable (`Reorder the cover`, `Reorder picture 2`), ↑ / ↓ move the focused row, and it carries `Move up` and `Move down` as screen-reader actions, nothing drawn — the cover no `Move up`, the last row no `Move down`. Pass `onMakeCover`, `onMoveUp`, `onMoveDown` per item.
- A described picture shows the quiet word "Described"; an undescribed one shows the primary "Describe" link into `DescribeSheet`.
- **On a published post's edit, every row carries `Crop`** right after `Describe` / `Described` (round 53, jakob 2026-11-17): pass `onCrop` per item; it opens the post's crop on that picture. The new post's sheets pass none — their crop is the wizard's step, one Back away.
- Builds on `BottomSheet` (88% max height). No caption under the rows: the first row's name, `Cover — shown first`, says the rule (jakob 2026-11-12).

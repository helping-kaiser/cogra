Use `PickedRow` wherever a composer surface summarizes the picked pictures — the details step, an edit screen's pictures row. The whole row is one affordance and it opens the Show all sheet (`PickedSheet`).

```jsx
<PickedRow
  items={[{ src: a, cover: true }, { src: b, progress: 0.65 }, { src: c, failed: true }]}
  caption="3 pictures — the body"
  onManage={openShowAll}
/>
<DescribeCounter described={1} total={3} onDescribe={openShowAll} />
```

**The row carries no "Crop" or "Edit" links** (2026-08-31: "none"). Managing the set is the Show all sheet's job, reached by tapping the row; re-cropping is the crop step's job, reached with Back — the wizard is linear, and a second entrance to the same step is the two-menus pattern the system refuses. Do not add shortcut links back.

`DescribeCounter` is the details step's entry into per-picture descriptions — the link plus the quiet "· n of m described" count. It sits under the row, not inside it.

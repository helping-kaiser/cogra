Use `PickedRow` wherever a composer surface summarizes the picked pictures — the details step, an edit screen's pictures row. The whole row is one affordance and it opens the Show all sheet (`PickedSheet`).

```jsx
<PickedRow
  items={[{ src: a }, { src: b, progress: 0.65 }, { src: c, failed: true }]}
  caption="3 pictures — the body"
  onManage={openShowAll}
/>
<DescribeCounter described={1} total={3} onDescribe={openShowAll} />
<DescribeCounter subject="video" described={0} total={1} onDescribe={openDescribe} />
```

**The first picture wears `Cover`**, as it does in the tray and in Show all — the row badges it by default; pass `cover: false` only where a set has no cover (seam 245, ask 13 F).

**The row carries no "Crop" or "Edit" links** (2026-08-31: "none"). Managing the set is the Show all sheet's job, reached by tapping the row; re-cropping is the crop step's job, reached with Back — the wizard is linear, and a second entrance to the same step is the two-menus pattern the system refuses. Do not add shortcut links back.

`DescribeCounter` is the details step's entry into per-picture descriptions — the link plus the quiet "· n of m described" count, over the permanent sub-line "Read aloud to people who can't see it." (2026-09-03; the same words `DescribeSheet` carries under its title, so the row and the sheet it opens say one thing). It sits under the row, not inside it. **A video takes one description for the whole clip** (2026-09-02): pass `subject="video"` with `total={1}`. Its cover never takes a description of its own — the cover is the video's face, not a second picture.

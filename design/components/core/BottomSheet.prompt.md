Use `BottomSheet` for a set of choices on a phone — the overflow menu, license terms, a filter with too many options for a segmented row. Use a dialog instead when the reader cannot proceed without answering.

```jsx
const [open, setOpen] = React.useState(false);

<BottomSheet open={open} onClose={() => setOpen(false)} ariaLabel="Post actions">
  <SheetTitle>This post</SheetTitle>
  <SheetItem label="Save" onSelect={() => setOpen(false)} />
  <SheetItem label="Cite in a new post" onSelect={() => setOpen(false)} />
  <SheetItem label="License terms" onSelect={() => { setOpen(false); openLicenseSheet(); }} />
</BottomSheet>
```

- **The heading's row is `SheetTitle`'s, never the board's.** When the line carries something besides the name — the screen's one "?", the switch the sheet exists for — it goes in `trailing`: `<SheetTitle trailing={<HelpDot ariaLabel="License" />}>License</SheetTitle>`. A close control is the one thing the slot never takes.
- **A sheet over a sheet is `stacked`.** The upper sheet takes the layer above, so the wash it already draws dims the sheet below instead of sliding under it, and its surface takes the next tonal rung: `<BottomSheet open stacked ariaLabel="Comment actions">`. The sheet below keeps its top edge, its handle and its title visible above the one in front — depth you can see beats depth you infer.
- **It covers the bottom bar.** A sheet is a decision surface; a navigation bar peeking under it offers to leave mid-decision.
- **Never open beside the stance pad.** One parked surface at a time — the pad owns the same corner of the screen.
- **Top corners only**, at the 28px rung. The bottom edge is the screen's, and a rounded bottom flush to the edge draws a gap that is not there.
- The grab handle is not a control. It says which edge this came from and which way it goes back.
- Content behind it stays live and focusable: a drawer is not a modal. If the choice really is unavoidable, that is a dialog — `DialogSurface`.
- It animates itself with `cg-sheet-in` / `cg-sheet-out`; pass `inline` for a specimen.

Use `BottomSheet` for a set of choices on a phone — the overflow menu, licence terms, a filter with too many options for a segmented row. Use a dialog instead when the reader cannot proceed without answering.

```jsx
const [open, setOpen] = React.useState(false);

<BottomSheet open={open} onClose={() => setOpen(false)} ariaLabel="Post actions">
  <SheetTitle>This post</SheetTitle>
  <SheetItem label="Licence terms" onSelect={() => { setOpen(false); showLicence(); }} />
  <SheetItem label="Copy link" onSelect={() => setOpen(false)} />
  <SheetItem label="Report" onSelect={() => setOpen(false)} />
</BottomSheet>
```

- **It covers the bottom bar.** A sheet is a decision surface; a navigation bar peeking under it offers to leave mid-decision.
- **Never open beside the stance pad.** One parked surface at a time — the pad owns the same corner of the screen.
- **Top corners only**, at the 28px rung. The bottom edge is the screen's, and a rounded bottom flush to the edge draws a gap that is not there.
- The grab handle is not a control. It says which edge this came from and which way it goes back.
- Content behind it stays live and focusable: a drawer is not a modal. If the choice really is unavoidable, that is a dialog — `DialogSurface`.
- It animates itself with `cg-sheet-in` / `cg-sheet-out`; pass `inline` for a specimen.

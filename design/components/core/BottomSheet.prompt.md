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
- **Never open beside the opinion pad.** One parked surface at a time — the pad owns the same corner of the screen.
- **Three height classes, one ceiling.** `maxHeight` defaults to **62%** and takes **88%** where the content needs the room (the license sheets, the filters, the opinions lists); `tallest` is the class at the ceiling itself — `<BottomSheet open tallest ariaLabel="Comments">`, which is the comments sheet and its pinned composer row. **No sheet's top edge rises above a 72px sliver below the safe area** (Android under the status bar and the cutout, web from the viewport top): the rounded corners keep a strip of the surface behind visible, and a drawer that reached the top edge would read as a destination. The ceiling caps the other classes rather than replacing them — a percentage that would reach it on a short screen is held under it, `height` included (the footed filter sheet pins itself at 88% so its Done row can sit beneath the scrolling sections).
- **A multi-line field in a sheet grows with what is written**, and the sheet grows with the field until the ceiling; from there the field scrolls inside itself and the Done row stays in reach. Never a line count — the field's maximum is viewport minus chrome, the same on both platforms.
- **Top corners only**, at the 28px rung. The bottom edge is the screen's, and a rounded bottom flush to the edge draws a gap that is not there.
- **It is modal** (readme §4, *Sheets*). It dims and covers what it was opened over; focus moves into it, stays inside while it is up, and returns to the control that opened it (readme §10). Nothing beneath the scrim takes a tap. If the choice really is unavoidable, that is a dialog — `DialogSurface`.
- **A sheet that holds a choice is one of two kinds** (readme §4, *Sheets*). **A staging sheet carries a commit, and dismissal discards** (the sheet law): it stages the choice until its `Done` (or whatever its foot names); the scrim, a swipe down, Back and Escape leave everything as it was. **An editing sheet applies live** (the editing-sheet exemption): each change applies the moment it is made, so every way out, `Done` included, just closes it and what was applied stands. The editing sheets are `ComposeTags`, `ComposePicked`, `EditPicked` and `ComposeCitations`; every other sheet that holds a choice stages. A menu's row is its own commit; a sheet that only lists has nothing to apply.
- **The drag is M3's.** It follows the finger from the handle area, and from a list at its scroll-top; it dismisses past about 25 % of its height or on a downward fling, and otherwise snaps back. No intermediate detents. A sheet hosting a pad drags only from its handle and title zone — the field owns every pointer that starts on it.
- The grab handle is not a button. It marks the handle area a drag starts from, and says which edge this came from and which way it goes back.
- It animates itself with `cg-sheet-in` / `cg-sheet-out`; pass `inline` for a specimen.

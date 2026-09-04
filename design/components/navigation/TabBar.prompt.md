The full-width row that chooses what the list beneath it shows.

```jsx
<TabBar
  ariaLabel="What the chronicle shows"
  value="everything"
  tabs={[
    { id: "posts", icon: "dynamic_feed", label: "Posts" },
    { id: "comments", icon: "chat_bubble", label: "Comments" },
    { id: "everything", icon: "history", label: "Everything" },
  ]}/>

<TabBar
  ariaLabel="Which direction"
  value="on"
  tabs={[{ id: "on", label: "On them" }, { id: "taken", label: "They've taken" }]}/>
```

**A cell's kind is its content.** Give a tab an `icon` and it draws a glyph, taking its accessible name from `label` — the only way an icon-only control gets one. Leave the icon out and `label` becomes the visible words, in `label-large`, with no aria-label at all: a second name for a button that already shows its own can only disagree with it. Never mix the two kinds in one row.

**Not a segmented pill** (jakob 2026-09-01) — that was ruled out at three options; a pill that wide stops reading as a control. This is the row every social profile draws.

**Selection is primary plus a 2px underline**, which is a deliberate deviation from "selection is colour only". Three same-weight glyphs cannot be told apart by colour alone, and this row is the only thing on the screen changing what is under it. The underline is an inset shadow, so choosing a tab never moves the row's height.

The cells are `aria-pressed` buttons in a labelled group, not an ARIA tablist: nothing here controls a `tabpanel`, it filters the list below. `ariaLabel` names the choice being made, not the thing being filtered.

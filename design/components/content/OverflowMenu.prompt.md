Use `OverflowMenu` for the interactions a reader does rarely — check a license, report content, open a proposal against it, copy a link. `PostCard` and `CommentCard` mount one automatically and append whatever you pass in `menuItems`.

```jsx
<PostCard {...post} menuItems={[{ label: "Report this", onSelect: report }]} />
<OverflowMenu items={[{ label: "Copy link", onSelect: copy }]} />
```

The dividing line: **the affordance row carries what a reader reaches for; the menu carries the rest.** A stance is the gesture the product lives on and belongs in the row. A license is checked once in a hundred readings and belongs in here.

The trigger is `more_vert` on `onSurfaceVariant`, in the card header beside the timestamp — never in the affordance row. The sheet is `surfaceContainerHigh` at the medium rung with `label-large` items at 48px. **No icons in the list** — a half-iconned menu is how an icon set starts to look accidental. No `error` colouring either: a destructive item looks like the rest, and the confirmation it opens carries the weight.

On Android the same inventory is a bottom sheet, which `design.md` §6 already lists in the scaffolding.

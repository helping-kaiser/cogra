Use `OverflowMenu` for the interactions a reader does rarely — save something, cite it in a new post, hide its author, check a license. `PostCard` and `CommentCard` mount one automatically and append whatever you pass in `menuItems`.

```jsx
<PostCard {...post} menuItems={[{ label: "Hide @ada", onSelect: hide }]} />
<OverflowMenu items={[{ label: "Cite in a new post", onSelect: cite }]} />
```

The dividing line: **the affordance row carries what a reader reaches for; the menu carries the rest.** An opinion is the gesture the product lives on and belongs in the row. A license is checked once in a hundred readings and belongs in here.

The trigger is `more_vert` on `onSurfaceVariant`, in the card header beside the timestamp — never in the affordance row. Pass `placement="row"` where the dot stands in a row of controls instead of on a 24px line: a profile's actions row, which is where the band law put every profile's ⋮. That draws 40px of ink with no negative pull and keeps the 48px target through `cg-hit`. The sheet is `surfaceContainerHigh` at the medium rung with `label-large` items at 48px. **No icons in the list** — a half-iconned menu is how an icon set starts to look accidental. No `error` colouring either: a destructive item looks like the rest, and the confirmation it opens carries the weight.

On Android the same inventory is a bottom sheet, which `design.md` §6 already lists in the scaffolding.

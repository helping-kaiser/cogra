/* THE DETAILS STAGE ON THE PICTURE PATH (readme §13, the menus round): the
   body is already picked, and this is where it gets its words. The twin of
   `ComposeCited` — same wizard header, same fields, same References block —
   with the media summary on top that the words path has nothing to show.

   THE ROW IS THE AFFORDANCE. `PickedRow` opens Show all and carries no Crop or
   Edit links of its own (jakob 2026-08-31, "none"); the crop step is one Back
   away, and a second entrance to the same stage is the two-menus pattern the
   system refuses elsewhere.

   ONE STAGED REFERENCE, THE SYSTEM'S OWN. The block is `StagedReference` — node
   mark, name, kind, the pair, and the remove × — because a citation staged on
   the picture path is the same citation staged anywhere else, and a board that
   draws its own version of it drifts from the one that doesn't. The row itself
   opens the citation's pair (`onEdit`, jakob 2026-09-10), the way the tag chips
   beside it open theirs.

   THE BODY IS `_shared.jsx`'s `ComposeDetailsBody`, because the reference pair
   sheet stands on this stage and draws it whole. */
export function Screen() {
  return <ComposeDetailsBody />;
}

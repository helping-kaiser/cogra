/* SHOW ALL, OVER THE EDIT (the edit body round, 2026-09-10) — the per-picture
   manager the edit's picked row opens: reorder (first = cover), remove,
   describe, the same `PickedSheet` the pick step and the details stage open.

   IT IS ITS OWN BOARD RATHER THAN `ComposePicked` because of the overlay rule
   (2026-09-08): a sheet covers the surface the reader came from, and that
   surface has to be the real one. `ComposePicked` draws the PICK STEP beneath
   its sheet — a tray, a prompt offering "Write words instead", a wizard foot —
   and an author editing a published post was never on that stage. The edit is
   written once in `_shared.jsx` for exactly this reason, and this board draws
   it whole, the way `EditActs` and `TagPair` do.

   THE SHEET IS WHERE A POST CHANGES KIND. Removing the last picture here is
   the media-to-words flip the ruling allows: with nothing left to manage the
   sheet has nothing to say, and what it closes onto is `EditWords` — the same
   edit, its body now a field. That is why the removal edge leaves this board
   and not `EditCompose`: the × that does it is drawn here.

   THE PICTURES ARE THE EDIT'S OWN — the two `EditComposeBody` carries, in its
   order, the first one the cover. A manager showing a different set than the
   row that opened it would be a third sketch of one post. */
const PICKED = [
  { src: "post-photo.jpg", alt: "The coast road", described: true },
  { src: "inviter.jpg", alt: "", onDescribe: () => {}, onRemove: () => {} },
];

export function Screen() {
  return (
    <>
      <EditComposeBody />

      <PickedSheet open items={PICKED} onClose={() => {}} />
    </>
  );
}

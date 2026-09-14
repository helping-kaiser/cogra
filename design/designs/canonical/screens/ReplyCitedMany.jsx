/* THE REPLY'S SEAL WITH MORE THAN ONE REFERENCE STAGED (jakob's ruling
   2026-09-14, backlog item 70). The same rule the post's seal takes, taken
   here: one citation reads back as itself, two or more read back as their
   count, and the counting row is a door. The rule is about citations, not about
   which composer staged them.

   THE FLOW ALREADY RECORDED THIS STATE. `ReplyCited`'s "+ Cite something" leads
   to the picker "a second reference — the staged one stays", so a comment with
   two citations was reachable before it was drawn — which is exactly the shape
   of hole item 70 opened on the other seal.

   THE COUNT IS BARE — 3, the citations and nothing else — and the total says
   what it counts in words: four things, signed together. The add-rows stay, and
   they stay because a comment's seal IS its details stage; nothing about
   counting the citations takes away the way to add another.

   THE DOOR OPENS THE COMPOSE PAGE'S SHEET. `ComposeCitations` is the master, as
   `ComposeLicense` and `ComposeSensitive` are the masters this seal's own rows
   already open — one surface, drawn once, wherever a staged collection is
   managed.

   IT IS AN ENTRY, NOT A DESTINATION, for `ReplyCited`'s reason: the picker
   hands each pick back to the composer it was opened from, so this is a state
   of the seal and not a screen a tap navigates to. */
export function Screen() {
  return <ReplySealBody cited={3} />;
}

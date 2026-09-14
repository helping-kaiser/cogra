/* THE REPLY'S SEAL WITH A REFERENCE STAGED (readme §13, the menus round).
   Referencing from inside a comment lives inside the comment's own wizard: the
   seal already carries "+ Add a tag" and "+ Cite something" side by side,
   because in a two-stage wizard the seal IS the stage where a comment's
   tags and references are named. This is what that surface looks like once
   the picker has handed one back.

   THE NAME OPENS THE CITATION'S PAIR (jakob 2026-09-10). A comment's citation
   carries the same two signed axes a post's does, so it gets the same editor —
   `RefPair`, the master on the compose page — and the row keeps two separately
   named controls, the name and the ×.

   A STAGED REFERENCE IS AN ACT, so it joins the acts card rather than sitting
   beside it — the total counts it, and the all-or-nothing subline appears the
   moment a signature carries more than one thing. A references block floating
   below the card would let the count and the content disagree.

   IT IS AN ENTRY, NOT A DESTINATION: the picker's result row lands back in the
   composer it was opened from, so nothing navigates here. `PostLicense` is the
   same shape — a state of a surface, drawn because it is designed, declared as
   an entry because no tap reaches it.

   THE BODY IS `_shared.jsx`'s `ReplySealBody` AT ONE CITATION (item 70). The
   reply's seal is one surface in three states — nothing staged, this one, and
   the count with its door — and three sketches of one seal are three chances to
   disagree about it. The states differ in the acts card's middle row and in
   what the total says; everything else is the same markup. */
export function Screen() {
  return <ReplySealBody cited={1} />;
}

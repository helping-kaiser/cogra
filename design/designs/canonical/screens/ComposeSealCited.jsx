/* THE POST'S SEAL WITH MORE THAN ONE CITATION STAGED (jakob's rulings
   2026-09-14, backlog item 70). The compose section lets an author stage up to
   ten references; the seal was drawn holding one, and every further citation
   had nowhere to be read back. This is the state that answers for all of them.

   THE ROW COUNTS INSTEAD OF NAMING — "3 cited", one line, the row a door to the
   sheet that lists them. Which is a decision about what a seal IS: a read-back
   the author checks before signing, not the composer said again. Three names
   stacked here would push the license, the stance and the sensitive rows off
   the screen at the exact moment the author is deciding whether to sign — and
   ten would make the seal a scroller. The count stays flat; the list is one tap
   behind it (`ComposeCitations`).

   THE TRAILING COUNT IS THE CITATIONS, BARE — 3, the list's length. One number,
   one fact. The signature's own total is the card's footer and says what it
   counts in words: six things, signed together.

   ONE CITATION IS STILL READ BACK AS ITSELF — `ComposeSeal` is that state, and
   this round did not touch it. The threshold is two, because two is where a
   name stops being the shortest true answer.

   IT IS AN ENTRY, NOT A DESTINATION. Nothing navigates to a seal by its
   citation count: the author walks the same Next from the same details stage,
   and what they staged there decides which state this seal is in. `ReplyCited`
   is declared the same way, for the same reason. */
export function Screen() {
  return <ComposeSealBody cited={3} />;
}

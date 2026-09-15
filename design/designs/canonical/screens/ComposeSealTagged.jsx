/* THE POST'S SEAL WITH MORE TAGS THAN THE ROW HOLDS (jakob's ruling
   2026-09-15). The composer lets an author stage as many tags as a post
   deserves, and the seal was drawn holding two. Past that the row kept drawing
   chips into a slot that clips them: two and a half pills, and a count beside
   them saying seven. This is the state that answers for all of them.

   THE ROW COUNTS INSTEAD OF NAMING — "7 tags", one line, the row a door to
   where the staged tags are managed. It is `ComposeSealCited`'s rule arriving
   at the row above it, and for the same reason: a seal is a read-back the
   author checks before signing, not the composer said again. Seven pills
   wrapped across three lines would push the license, the stance and the
   sensitive rows off the screen at the exact moment the author is deciding
   whether to sign. The count stays flat; the names are one tap behind it.

   TWO ARE STILL READ BACK AS THEMSELVES — `ComposeSeal` is that state, and
   this round did not touch it. The threshold is what the slot holds, not a
   number chosen for it: a tag is short enough that its own name is the
   shortest true answer until the row runs out of room.

   THE COUNT IS THE TAGS, BARE — 7, the staged set's length. The signature's
   own total is the card's footer and says in words what it counts: nine
   things, signed together.

   IT IS AN ENTRY, NOT A DESTINATION. Nothing navigates to a seal by its tag
   count: the author walks the same Next from the same details stage, and what
   they staged there decides which state this seal is in. `ComposeSealCited`
   is declared the same way, for the same reason. */
export function Screen() {
  return <ComposeSealBody tags={SEAL_TAGS_MANY} />;
}

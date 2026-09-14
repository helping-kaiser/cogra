/* CHATS · NOT HERE YET — what the band's chats icon opens (item 68, ruled
   2026-09-14: chats moved down the release order, the band law did not move
   with them, and the icon stays on every root band).

   THE ICON KEEPS ITS CORNER, SO THE TAP KEEPS ITS DESTINATION. The trailing
   cluster is [the screen's own control] · chats · bell on every root, and that
   uniformity is the whole reason the cluster exists — a reader aiming at chats
   aims at the same corner whatever tab they are on. Dropping the icon until
   messaging ships would move the bell on every root and move it back later,
   which costs every reader the muscle memory twice to save one screen. So the
   icon stays and this is what it opens.

   A DOOR THAT SAYS WHAT IS BEHIND IT IS NOT A DEAD END. The alternative — a
   tap that does nothing — reads as a broken build, and the reader's next move
   is to tap it again. One calm sentence answers the only question they have.

   IT IS THE EMPTY-STATE IDIOM, NOT A NEW ONE. `NotificationsEmpty` and
   `SavedEmpty` draw a list surface with nothing in it: the page header with the
   back arrow, one quiet line where the rows would start, the nav beneath. This
   is that surface in the state it will be in until messaging exists, so it is
   drawn with that furniture and the words carry the difference.

   NO ACTION BUTTON, for `SavedEmpty`'s reason taken to its limit: `EmptyState`
   carries the one action that fills the list where there is one, and nothing —
   here, not yet anything at all — fills this one.

   COPY IS A PROPOSAL, NOT BLESSED VOCABULARY. The line below is this round's
   recommendation; the alternates and the timing question are in copy-voice
   under "Awaiting blessing — the chats coming-soon screen". Nothing else on
   this board is new words. */
export function Screen() {
  return (
    <>
      <PageHeader title="Chats" backHref="#" backLabel="Back" />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "8px 24px" }}>
        <EmptyState title="Chats aren't built yet. When they are, your conversations will be here." />
      </div>
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}

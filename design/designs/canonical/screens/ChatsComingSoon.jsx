/* CHATS · NOT HERE YET — what the band's chats icon opens (item 68, ruled
   2026-09-14: chats moved down the release order, the band law did not move
   with them, and the icon stays on every root band).

   THE ICON KEEPS ITS CORNER, SO THE TAP KEEPS ITS DESTINATION. The trailing
   cluster is [the screen's own control] · chats · bell on every root, and that
   uniformity is the whole reason the cluster exists — a reader aiming at chats
   aims at the same corner whatever tab they are on. Dropping the icon until
   messaging ships would move the bell on every root and move it back later,
   which costs every reader the muscle memory twice to save one screen. So the
   icon stays and this is what it opens — the V1.0 scope cut's principle, read
   from this door: a door belongs to a slot, never to a list (readme §13, *The
   V1.0 scope cut*).

   A DOOR THAT SAYS WHAT IS BEHIND IT IS NOT A DEAD END. The alternative — a
   tap that does nothing — reads as a broken build, and the reader's next move
   is to tap it again.

   IT WEARS THE COMING-SOON CARD (jakob 2026-09-25, the drawn-anatomy ruling):
   `ComingSoonCard` — the brand wash, a headline and one line — so the door
   reads as a page that meant to say this, not one that failed to load. The
   page around it is still the list surface's furniture — the header with its
   back arrow, the bar beneath — because this is where the conversations will
   be; the card is the one moment on it. The wallet slot's door wears the same
   card with the same face (`WalletComingSoon`).

   NO ACTION BUTTON, for `SavedEmpty`'s reason taken to its limit: `EmptyState`
   carries the one action that fills the list where there is one, and nothing —
   here, not yet anything at all — fills this one.

   IT NAMES THE PROMISE THE WAY THE SKY CARD DOES (jakob's ruling 2026-09-14).
   Both surfaces stand in for something drawn after the MVP, and a product that
   says `coming soon` on one and something else on the other has two answers to
   one question. So the headline takes the Sky card's construction — the thing,
   an em dash, the promise — and the line under it is one sentence of what will
   be here. The words are the blessed ones in copy-voice under "The coming-soon
   surfaces", split at the full stop between headline and line; nothing else on
   this board is new words. */
export function Screen() {
  return (
    <>
      <PageHeader title="Chats" backHref="#" backLabel="Back" />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "8px 0 0" }}>
        <ComingSoonCard thing="Chats" line="Your conversations will be here." />
        <div style={{ flex: 1 }} />
      </div>
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}

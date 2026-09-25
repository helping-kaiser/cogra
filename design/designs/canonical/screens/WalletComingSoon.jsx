/* WALLET · NOT HERE YET — what the bottom bar's wallet slot opens in V1.0
   (readme §13, *The V1.0 scope cut*, jakob 2026-09-24/25: the wallet slot opens
   the door; the eleven wallet boards live in the post-MVP tree until the rail's
   slice is the work).

   THE SLOT KEEPS ITS PLACE, SO THE TAP NEEDS SOMEWHERE TO LAND. A door belongs
   to a slot, never to a list: the bar carries all five icons because a thinner
   bar reads wrong, and re-adding a slot later costs every reader the muscle
   memory twice — the chats icon's reason (`ChatsComingSoon`), read from the
   bar. The slot is `ALL_SLOTS`'s fourth, unchanged; this is what it opens.

   IT IS A TAB ROOT, AND IT IS DRAWN AS ONE. The band above and the bar below
   with the wallet slot selected — the shell every other root wears, so the
   reader is standing on the Wallet tab and the door is simply what that tab
   holds today. No back arrow: a root has none, and the platform's back runs
   from another tab's root to Feed's root (the re-tap ladder). The band carries
   chats and the bell like every signed-in root.

   IT WEARS THE COMING-SOON CARD (the drawn-anatomy ruling): `ComingSoonCard`,
   the brand wash with a headline and one line, the same face the chats door
   wears. The headline is the master's construction — the thing, an em dash,
   `coming soon` — and the line is one sentence of what will be here, in the
   chats door's shape.

   ONE DOOR FOR EVERY READER STATE (§13: "it serves every reader state with one
   face"). A member, a member whose key is elsewhere, an applicant — and a
   guest (jakob 2026-09-25) — all land here and meet the same card: a door
   promises a feature, not the reader's own data, so there is nothing to gate,
   which is where it differs from the chats icon (a guest has no chats to come
   back to; a coming-soon wallet is the same news for everyone). A rejected
   applicant is an applicant here — a created account that still needs to be
   vouched in (jakob 2026-09-25). What the reader state still decides is where
   the bar and the band go next, which is the graph's `case` work, not a
   second drawing. The line `Your earnings will be here.` is blessed
   (copy-voice, the coming-soon surfaces; jakob 2026-09-25).

   NO ACTION, so no "keep browsing" (the audit's F38 finding). A door has
   nothing a reader can do in it, and the bar is already the way on; were an
   action ever added, on a tab root it would select Feed's root rather than pop
   history, which on the web can leave the site entirely. */
export function Screen() {
  return (
    <>
      <CograBand />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "8px 0 0" }}>
        <ComingSoonCard thing="Wallet" line="Your earnings will be here." />
        <div style={{ flex: 1 }} />
      </div>
      <BottomNav active="wallet" slots={ALL_SLOTS} inline />
    </>
  );
}

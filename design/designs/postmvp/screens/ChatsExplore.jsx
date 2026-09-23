/* CHATS · all chats — the explorer, the page's second face (would-like #3;
   jakob's rulings 2026-09-23).

   EVERY CHAT, BY THE ORDINARY RANK, AND NO SECOND ALGORITHM (jakob, the reel's
   precedent). The list is the slice-3 rank narrowed to chats: the same graph,
   the same ranking, a mechanical filter on the kind. Nothing labels it as a
   special feed — no "recommended", no "for you" — because a header claiming a
   different ordering is the reassurance only a product that ranks two ways
   needs. The rank orders the list and yields the row's edge to the join
   (`ReferenceRow`'s picker rule), so no number is drawn.

   ONE TOGGLE: `Not already a member` (jakob). A filter chip at the head of the
   list — `Chip`'s own job, a condition the reader turns on and off — which,
   when on, leaves out the chats the reader is already in. Drawn OFF, so the
   board can show every row the explorer carries: two chats the reader is in,
   wearing `Member`, among the ones they are not.

   THE ROW'S JOIN SPEAKS THE CHAT'S POLICY (jakob). An open chat says `Join`;
   one that takes requests says `Ask to join`; an invite-only chat is listed
   and readable like any other but offers a stranger nothing to press, so its
   slot carries the quiet `Invite only`. How a request is decided belongs to
   the chat's governance, which ships its default silently — nothing about it
   is said here.

   READING COMES FIRST. A row opens the chat itself: chats are public reads
   (readme §13, the search rulings — encrypted messages show as what they are,
   but they show), so a reader who is not a member reads the thread before
   deciding. That non-member face — the thread with the join where the foot
   would be — is not drawn this round (graph: a gap); a chat the reader is in
   opens `ChatThread`.

   THE GUEST'S FACE IS THIS ONE (not drawn as a variant). A guest reads the
   explorer exactly as drawn, rows and threads alike; the joins and the swap
   back to `Your chats` are where a guest meets the join prompt, the ordinary
   guest gate, because those are the first acts on this page that need an
   account. */
export function Screen() {
  return (
    <>
      <ChatsTop face="all" />
      <div style={{ flex: "none", display: "flex", padding: "12px 16px 0" }}>
        <Chip label="Not already a member" selected={false} />
      </div>
      <ChatsColumn>
        <ChatExploreRow name="Harbour office" about="Opening hours, notices, and the lost-and-found." join="request" />
        <ChatExploreRow name="Coast walkers" image="post-photo.jpg" about="Low-tide walks on the flats, planned the night before." join="member" />
        <ChatExploreRow name="Slipway repairs" about="Volunteers for the spring repair — tools, tides, tea." join="open" />
        <ChatExploreRow name="Salt-crust rubbings" about="Paper, wax, and whatever the wind allows." join="member" />
        <ChatExploreRow name="Night fishing crew" about="Tides, weather, and who has the boat this week." join="invite" />
        <ChatExploreRow name="Sea wall market" about="Who is selling what on Sunday, and where to find them." join="open" />
      </ChatsColumn>
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}

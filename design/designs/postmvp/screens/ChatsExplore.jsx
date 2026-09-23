/* CHATS · all chats — the explorer, the page's second face (would-like #3;
   jakob's rulings and canvas review 2026-09-23).

   EVERY CHAT, BY THE ORDINARY RANK, AND NO SECOND ALGORITHM (jakob, the reel's
   precedent). The list is the slice-3 rank narrowed to chats: the same graph,
   the same ranking, a mechanical filter on the kind. Nothing labels it as a
   special feed — no "recommended", no "for you" — because a header claiming a
   different ordering is the reassurance only a product that ranks two ways
   needs. The rank orders the list and yields the row's edge to the join
   (`ReferenceRow`'s picker rule), so no number is drawn.

   ONE FILTER, A QUIET SWITCH, ON (jakob): `Hide chats you're in`
   (`HideJoinedSwitch`). This face exists to find chats the reader is not in,
   so every row drawn is one they could join; the chats they are in are the
   other tab. Off, those rows join the list wearing `Member`.

   THE LAST MESSAGE IS THE SECOND LINE, AND HERE IT IS OFTEN LOCKED. A
   non-member holds no key to any chat, so every encrypted last message reads
   `An encrypted message` with the lock before it — three of the six rows. The
   plaintext ones read in full: chats are public reads.

   THE ROW'S JOIN SPEAKS THE CHAT'S POLICY (jakob). An open chat says `Join`;
   one that takes requests says `Ask to join`; an invite-only chat is listed
   and readable like any other but offers a stranger nothing to press, so its
   slot carries the quiet `Invite only`. How a request is decided belongs to
   the chat's governance, which ships its default silently — nothing about it
   is said here.

   READING COMES FIRST. A row opens the chat itself — `ChatThreadReader`, the
   thread with the join where a member's foot would be — so a reader reads
   before deciding.

   THE TOP RETRACTS ON SCROLL AND THE FAB STAYS, exactly as on `Your chats`:
   the same control in the same corner on both faces.

   THE GUEST'S FACE IS THIS ONE (not drawn as a variant). A guest reads the
   explorer exactly as drawn, rows and threads alike; the joins, the FAB and
   the swap back to `Your chats` are where a guest meets the join prompt, the
   ordinary guest gate, because those are the first acts on this page that
   need an account. */
export function Screen() {
  return (
    <>
      <ChatsTop face="all" />
      <HideJoinedSwitch on />
      <ChatsColumn>
        <ChatExploreRow name="Harbour office" preview={<NoKeyPreview sender="Kel Moreau" />} join="request" />
        <ChatExploreRow name="Sea wall market" image="gallery-honey.jpg" preview="Mira Voss: Honey is back on the stand from Saturday." join="open" />
        <ChatExploreRow name="Night fishing crew" preview={<NoKeyPreview sender="Tobias Lindqvist" />} join="invite" />
        <ChatExploreRow name="Slipway repairs" preview="Juno Baptiste: Bring gloves — the new planks splinter." join="open" />
        <ChatExploreRow name="Birdwatch at the point" preview={<NoKeyPreview sender="Ada Okonkwo" />} join="request" />
        <ChatExploreRow name="Tide tables" preview="Kel Moreau: Spring tides this weekend, lowest on Sunday." join="open" />
      </ChatsColumn>
      <NewChatFab />
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}

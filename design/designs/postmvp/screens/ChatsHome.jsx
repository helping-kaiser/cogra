/* CHATS · your chats — what the band's chats icon opens once chats exist
   (would-like #3; jakob's rulings 2026-09-23). `ChatsComingSoon` holds this
   corner in canonical until the round migrates.

   A MESSENGER'S LIST, AND DELIBERATELY SO. Every chat the reader is in, newest
   activity first: the chat's picture or, on a 1:1, the other person's face;
   its name; one line of the last message; the age, and the unread dot under
   it. A muted chat wears the silenced speaker beside its name and keeps its
   place — muting quiets a chat's announcements, it does not demote it. This is
   the one surface where CoGra takes messenger convention whole (the chats
   round's charter, `_shared.jsx`), so nothing here is invented: a reader who
   has used any chat app has already learned this page.

   NEW CHAT STARTS BOTH KINDS HERE (jakob 2026-09-23): a 1:1 AND a group both
   begin from this page, as well as from a person's own Message button. It is
   `Invites`' standing entry point — a filled button at the head of the column,
   a noun, because this system has no floating create and a long list must
   never bury it. The group's founding is `ChatCreate`; the 1:1's first step —
   choosing the one person — is not drawn this round, and neither is the
   choice between the two the button opens onto (graph: the group lands, the
   1:1 is a gap).

   THE OTHER FACE IS ONE TAP AWAY, AND IT SWAPS BACK. `All chats` is the
   explorer (`ChatsExplore`) — every chat, ranked the ordinary way; `Your
   chats` returns here. The "?" is the page's one, and will hold the
   what-you-sign education (`ChatsTop`).

   A GUEST NEVER STANDS ON THIS FACE. Chats are public reads, so a guest reads
   the explorer freely; the swap back to `Your chats` is where a guest meets
   the join prompt, because a list of one's own chats is the first thing here
   that needs an account (not drawn — the guest gate's ordinary shape).

   THE PREVIEW NEVER SHOWS WHAT THE READER CANNOT READ. `Salt-crust rubbings`
   ends on a message sealed to others: its line says `An encrypted message`,
   the notice's own words, never a line of scrambled text. */
export function Screen() {
  return (
    <>
      <ChatsTop face="yours" />
      <ChatsColumn>
        <Button style={{ width: "100%" }}>New chat</Button>
        <ChatRow name="Coast walkers" image="post-photo.jpg" preview="Mira Voss: Six it is. Meet at the harbour office." when="35m" unread />
        <ChatRow name="Ada Okonkwo" person="Ada Okonkwo" preview="The third headland light is real — I have a print that almost catches it." when="2h" unread />
        <ChatRow name="Headland honey" image="gallery-honey.jpg" preview="Kel Moreau: Jars are back on the stand from Saturday." when="5h" muted />
        <ChatRow name="Tobias Lindqvist" person="Tobias Lindqvist" preview="You: See you at the slipway." when="1d" />
        <ChatRow name="Salt-crust rubbings" preview="Juno Baptiste: An encrypted message" when="3d" />
      </ChatsColumn>
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}

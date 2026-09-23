/* CHATS · your chats — what the band's chats icon opens once chats exist
   (would-like #3; jakob's rulings and canvas review 2026-09-23).
   `ChatsComingSoon` holds this corner in canonical until the round migrates.

   A MESSENGER'S LIST, AND DELIBERATELY SO. Every chat the reader is in, newest
   activity first: the chat's picture or, on a 1:1, the other person's face;
   its name; one line of the last message; the age, and the unread dot under
   it. A muted chat wears the silenced speaker beside its name and keeps its
   place — muting quiets a chat's announcements, it does not demote it. This is
   the one surface where CoGra takes messenger convention whole (the chats
   round's charter, `_shared.jsx`), so nothing here is invented: a reader who
   has used any chat app has already learned this page.

   THE ROW'S TIME IS THE AGES LADDER — a row answers "how fresh"; the thread
   inside it is where the exact clock lives.

   THE PREVIEWS READ. Salt-crust rubbings' last message was sent encrypted and
   shows Juno's words, because the reader holds its key; Sea wall choir's shows
   the locked `An encrypted message`, because its last message predates the
   reader's arrival and was sealed under a key they were never given — the one
   no-key row this list is drawn with, and the rare case it is on your own
   list (`NoKeyPreview`).

   NEW CHAT FLOATS (`NewChatFab`, the product's first FAB): bottom-right over
   the list, staying put while the list scrolls and the top retracts. It opens
   `ChatPicker`, where a 1:1 and a group both begin.

   LONG-PRESS A ROW for the chat's options (`ChatRowMenu`); a tap opens it.

   THE OTHER FACE IS ONE TAP AWAY, AND IT SWAPS BACK. `All chats` is the
   explorer (`ChatsExplore`); `Your chats` returns here. The "?" opens
   `ChatsHelp`.

   A GUEST NEVER STANDS ON THIS FACE. Chats are public reads, so a guest reads
   the explorer freely; the swap back to `Your chats` is where a guest meets
   the join prompt, because a list of one's own chats is the first thing here
   that needs an account (the guest gate's ordinary shape, not drawn). */
export function Screen() {
  return <ChatsHomeBody />;
}

/* NEW CHAT · the people picker — what the floating New chat opens (would-like
   #3; jakob 2026-09-23, confirming WhatsApp's shape).

   ONE DOOR FOR BOTH KINDS. A 1:1 and a group both start here: tap a person and
   the 1:1 opens; tap `New group chat` at the head and the same list becomes a
   multi-pick (`ChatPickerGroup`) that ends in the founding. There is no
   structural line between the two (chats.md §9 — a chat with two members is a
   1:1, a third makes it a group), so the picker draws none either: the group
   row is simply the other way through the same list.

   `ReferencePicker`'S ANATOMY, AT PERSON KIND. The header, the bar, the rows —
   the face, the name, the handle — because choosing someone to talk to is the
   same errand as choosing someone to cite with a different record at the end.
   Ranked the ordinary way; the number yields to the row's own act.

   THE GROUP ROW IS A DOOR, AND LOOKS IT: `ContentRow`'s door variant, the
   filled disc the wallet's entrances wear — the one row here that is an
   entrance rather than an entry.

   SOMEONE YOU ALREADY SHARE A 1:1 WITH gets asked first (`ChatExistingAsk`):
   carry on there, or truly start another.

   NO BOTTOM BAR — picking is a task, not the tab (`ReferencePicker`'s own
   reason). */
export function Screen() {
  return <ChatPickerBody />;
}

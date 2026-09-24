/* A CHAT'S OPTIONS — long-press on a row of your chats (would-like #3; jakob
   2026-09-23: "people long-click chats everywhere").

   THE MENUS ROUND'S SHEET, AT CHAT SCALE. `ReaderPostMenu`'s anatomy exactly —
   a sheet of `SheetItem` rows over the surface it was opened from, dropped by
   the scrim, the swipe or Escape — because a menu is the same menu wherever
   its trigger sits. The trigger here is the gesture rather than a ⋮: a chat
   row's tap is spent on opening the chat, and every messenger a reader uses
   puts a chat's options under a held finger.

   IT IS TITLED BY THE CHAT. A post's menu needs no title because the post is
   right there under it; a held row in a list of eight is not, once the sheet
   covers half of them. `SheetTitle` names the chat the options are for.

   TWO ROWS, BOTH REAL. `Mute` silences the chat's device push — and only
   that: messages never write bell rows, so there is no tray share to silence
   (jakob 2026-09-23) — and leaves its place and its unread dot on the list;
   on a muted chat the row reads `Unmute`, the verb a control owes (copy-voice,
   *Register*). The same switch stands on the detail surface; either one flips
   the one per-chat setting. `Chat details` opens that surface
   (`ChatDetails`) — the same destination the thread's header opens.

   LEAVE IS NOT A ROW HERE. Leaving is a real act — a Leave record, unilateral
   and permanent in the history (chats.md §4) — and it lives on the detail
   surface, at the foot of what the reader is leaving: the members, the
   description, the history. A held row in a list is the wrong place to meet
   it. */
export function Screen() {
  return (
    <>
      <ChatsHomeBody />
      <BottomSheet open ariaLabel="Coast walkers — chat options">
        <SheetTitle>Coast walkers</SheetTitle>
        <SheetItem label="Mute" />
        <SheetItem label="Chat details" />
      </BottomSheet>
    </>
  );
}

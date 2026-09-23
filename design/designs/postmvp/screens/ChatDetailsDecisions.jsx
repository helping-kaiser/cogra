/* CHAT DETAILS WITH DECISIONS OPEN — `ChatDetails`' page with its `Open
   decisions` section filled (round B2 of the chats work, the governance round;
   jakob 2026-09-23: the same decisions appear in the thread as cards and here
   as rows).

   THE SAME CHAT AS `ChatThreadDecisions` — Salt-crust rubbings, the reader a
   plain member — so the two surfaces can be read against each other: the kick
   Mira proposed, with the reader's `Agree`, and the reader's own rename, count
   only. The settled role change is not here: the section holds what is still
   being decided, and Tobias's `Moderator` on the member list is what his
   settled one left behind.

   A ROW IS WHAT, THEN HOW MANY, THEN THE READER'S ACT (`OpenDecisions`). The
   count is the thread card's own — people, never weight, with the arithmetic
   in geek mode — and the act is the same `Agree`, signing the same one record.
   THE WORDS ARE A DOOR TO THE CARD IN THE THREAD, scrolled to its moment, split
   from the act `RoleDoor`'s way, so the row can be read, opened or agreed to
   without one target standing inside another.

   A JOIN REQUEST, where one waits, is a row like these with `Approve` at its
   end for an admin or a moderator and no count (one approval settles it under
   the default map) — `ChatRequestApprove`'s card, said as a row. Not drawn:
   this chat is invite only.

   THE REST OF THE PAGE IS THE MEMBER'S DETAILS UNCHANGED (`ChatDetailsBody`):
   `Edit chat` stands because the map lets every active member propose a
   change — the rename came from exactly there; `Add people` heads the members
   because any member may invite; every role word is a door, the reader's own
   included. The list runs by role, then the reader first among the members.

   THE FRAME IS TALLER THAN A PHONE so the whole page reads at once, as
   `ChatDetails`' does. */
export const FRAME = { width: 390, height: 1104 };

export function Screen() {
  return <ChatDetailsBody chat={SALT_CRUST} members={SALT_CRUST_MEMBERS} decisions={SALT_CRUST_DECISIONS} />;
}

/* CHAT DETAILS WITH DECISIONS OPEN — `ChatDetails`' page with its `Open
   decisions` section filled (round B2 of the chats work, the governance round;
   jakob 2026-09-23: the same decisions appear in the thread as cards and here
   as rows; his fix pass 2026-09-24).

   THE SAME CHAT AS `ChatThreadDecisions` — Salt-crust rubbings, the reader a
   plain member — so the two surfaces can be read against each other: the kick
   Mira proposed, awaiting the reader's vote, and the reader's own change to
   the chat's name, picture and description, count only. The settled
   decisions are not here: the section holds what is still being decided, and
   Tobias's `Moderator` on the member list is what his settled one left
   behind.

   A ROW IS THE CARD WITHOUT ITS OUTLINE (`OpenDecisions`): the sentence and
   the count — people who agree, never weight — as a door to the decision whole
   (`ChatDecisionDetail`: the full contents, every vote, the reader's own), and
   under them, at the row's right edge, the vote's two words where the reader
   has not voted — `Disagree` quiet, `Agree` filled — each opening the vote's
   small seal (`ChatAgreeSheet`), never signing on the tap. The two words take
   a line of their own: beside the sentence they would crush it to a column.

   A JOIN REQUEST, where one waits, is a row like these with `Approve` alone at
   its edge for an admin or a moderator and no count (one approval settles it
   under the default map) — `ChatRequestApprove`'s card, said as a row. Not
   drawn: this chat is invite only.

   THE REST OF THE PAGE IS THE MEMBER'S DETAILS UNCHANGED (`ChatDetailsBody`):
   `Edit chat` stands because the map lets every active member propose a
   change — the reader's change came from exactly there; `Add people` heads
   the members because any member may invite; every role word is a door, the
   reader's own included. The list runs by role, then the reader first among
   the members.

   THE FRAME IS TALLER THAN A PHONE so the whole page reads at once, as
   `ChatDetails`' does. */
export const FRAME = { width: 390, height: 1152 };

export function Screen() {
  return <ChatDetailsBody chat={SALT_CRUST} members={SALT_CRUST_MEMBERS} decisions={SALT_CRUST_DECISIONS} />;
}

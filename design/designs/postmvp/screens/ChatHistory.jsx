/* A CHAT'S EDIT HISTORY — the details' `Edit history` (round B1 of the chats
   work; jakob's rulings 2026-09-23).

   THE CHANGE-HISTORIES PATTERN, VERBATIM. Whole versions, newest first, the
   current one marked by its dateline, and never a diff: each card is the chat
   as a reader met it then — the face, the name, who could join and the words —
   and a reader comparing two reads which parts moved. It is the same list the
   post, the comment and the profile get, drawn by the same column
   (`HistoryColumn`, `VersionBlock`) and dated in the same words (`Current
   version · signed 18 September`).

   A CHAT'S VERSIONS ARE ITS SUCCESSIONS. On L1 the chat's current metadata is
   the lineage head's founding payload, and every change founds a new head
   carrying the whole new state (chats.md §8) — layered full states, exactly
   the shape this pattern was drawn for. Superseded heads stay published, so
   every version stays readable here, to anyone: chats are public.

   MEMBERSHIP EVENTS STAND BETWEEN THE VERSIONS AS QUIET ROWS (jakob), each at
   its own date — joined, left, invited — and NONE IS PART OF A VERSION.
   Membership is its own fold over its own records (chats.md §4) and carries
   across a succession with nobody acting, so a card listing members would be
   a snapshot no payload holds. The rows are `ChatEventRow`: a face at row
   scale, one sentence, the date — no container, every word in the quiet ink,
   so they read as notes between two cards and never as a third kind of card.
   An event newer than the newest version sits above it, because the list is
   ordered by time and not by kind: here, the invitation Ada has not answered.

   A LEAVE CARRIES ITS PARTING REASON WHERE ONE WAS GIVEN (jakob: the Leave
   record's optional payload) — the leaver's own words, public, quoted under
   the sentence. It is what `ChatLeaveConfirm`'s field writes.

   THE BOARD DRAWS THE TOP OF THE LIST. The chronicle runs on below the third
   version — more joins, down to the founding, the first version, and the
   chronicle's closing law (`CHRONICLE_FOOTNOTE`) at its foot — and the frame
   stops where a phone's scroll would, one event past the third card.

   EVERY VERSION CARRIES `Remove this version` (jakob 2026-09-23, the fix
   pass). jakob's case: someone changed the chat's picture to one a member
   never wanted public — that version has to be removable. It is a chat
   decision, `decision:redact_version` (chats.md §5, gated as
   `disavow_message` is: > 50% of the weighted cast, ≥ 20% quorum), so the act
   opens its think-twice dialog (`ChatVersionRemoveConfirm`, the governance
   round) and, through the removal's seal, either the removal at once or a
   pending card in the thread. The act is the author's register's own (`RemoveVersionAct`,
   on the dateline's baseline), on every version with a payload, the current
   one included.
   A CHAT HAS NO AUTHOR — its creator is only its creator, and every version
   was executed for the chat by its system actor on its members' decision — so
   unlike a post's own register, the door shows for EVERY member, not only
   for whoever proposed the change. A reader outside the chat reads this
   same list without the acts (`ChatDetailsReader`'s door lands here).
   A REMOVED VERSION IS TOMBSTONED BY THE CHANGE-HISTORIES GRAMMAR, drawn on
   `ChatHistoryRemoved`: the row stays at its own date, the chat's own mark
   stands where the face, the name and the words were, and the act's slot says
   `Already removed`. Removing the CURRENT version never republishes an earlier one —
   the head never falls through (erasure.md §1); the chat shows its current
   metadata as removed until a new version is signed.
   The version cards are inert: a chat has no historic detail surface to open
   (the profile chronicle's precedent), so the historic banner has no page to
   stand on in this round. */
export const FRAME = { width: 390, height: 904 };

export function Screen() {
  return <ChatHistoryBody />;
}

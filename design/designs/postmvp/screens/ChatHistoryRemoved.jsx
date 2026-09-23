/* A CHAT'S EDIT HISTORY AFTER A VERSION WAS REMOVED (round B2 of the chats
   work, the governance round; jakob 2026-09-23).

   THE SAME CHRONICLE (`ChatHistoryBody`), ONE VERSION TOMBSTONED IN PLACE —
   the change-histories grammar at chat scale. The 10 September version keeps
   its row, its dateline and its date between the same membership events; its
   card gives way to `ChatVersionTombstone` — the reserved disc where the
   picture was, and the mark where the name, the words and who could join
   stood — and its act's slot says `Already removed`, the finished act's word
   where the act would stand. Nothing moved up to fill the gap, because
   nothing was taken out of the list: removal takes the payload, never the
   record (chats.md §8, layers.md §5).

   THE MARK IS THE CHAT'S OWN — `Removed by the chat's decision`, the fourth
   `RedactedContent` reason this round adds. The author's mark would name a
   person a chat does not have, and the platform's would dress the members'
   own choice as a verdict; the honesty rule that the marks never stand in for
   one another is why a fourth exists (copy-voice, *Two removal marks*). Its
   line is the post tombstone's, dated and naming the chat's own fields.

   WHO DECIDED IS PUBLIC, AND NOT PRINTED HERE: the passed decision's records
   stand on the graph (and its card settled into its outcome line in the
   thread at its own moment); the chronicle keeps to versions and membership,
   as the details round drew it.

   The fixture follows `ChatVersionRemoveConfirm`: the reader's say cleared the
   gate, so after the seal the removal happened at once. */
export const FRAME = { width: 390, height: 904 };

export function Screen() {
  return <ChatHistoryBody removed />;
}

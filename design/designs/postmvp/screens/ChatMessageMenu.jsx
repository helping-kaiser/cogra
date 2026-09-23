/* A MESSAGE'S ACTS — long-press on a bubble (would-like #3; jakob 2026-09-23:
   every act CoGra takes on a message lives behind the long-press, never worn
   on the bubble).

   THE COMMENT'S MENU, POINTED AT A MESSAGE. A message is first-class content —
   stance-able, citable, saveable like a post or a comment (chats.md §1) — and
   a comment is the nearest kind: it too lives inside another surface and has
   no detail page of its own, so `COMMENT_MENU`'s rows and order carry over:
   the acts first, the readings after, the license closing it. Save leads, as
   it leads every menu that has it (the private-viewer-state round).

   TWO ROWS THE COMMENT DOES NOT NEED. A comment wears its opinion control on
   its card; a bubble wears nothing, so `Give your opinion` is a row here and
   opens the ordinary pad over the thread. And `Reply` — the messenger's reply,
   a new message in this chat that quotes this one (a Reference from the
   message, chats.md §3); the foot takes the quote and the field is ready.

   NO EDIT ROW, EVER. Messages never edit (jakob; chats.md §8) — a correction is
   the next message. The reader's OWN message adds `Remove` beside these rows,
   the per-content removal every kind carries (erasure.md §1); that variant is
   stated here, not drawn.

   THE MESSAGE HELD IS JUNO'S, the readable encrypted one: its menu is the same
   as a plaintext message's, because encryption hides the words from outsiders
   and changes nothing about what the reader may do with a message they can
   read. */
export function Screen() {
  return (
    <>
      <ChatThreadBody />
      <BottomSheet open ariaLabel="Message actions">
        <SheetItem label="Save" />
        <SheetItem label="Cite in a new post" />
        <SheetItem label="Give your opinion" />
        <SheetItem label="Reply" />
        <SheetItem label="Cited by" />
        <SheetItem label="Opinions on this" />
        <SheetItem label={LICENSE_MENU_LABEL} />
      </BottomSheet>
    </>
  );
}

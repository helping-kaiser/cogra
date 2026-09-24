/* YOUR OWN MESSAGE'S ACTS — long-press on one of the reader's own bubbles
   (round B3 of the chats work, the integration round; round A stated this
   variant on `ChatMessageMenu` and did not draw it).

   THE SAME SHEET, WITH `Remove` JOINED AMONG THE ACTS. Every kind of content
   carries its author's per-content removal (erasure.md §1), and a message is
   content. `OWN_POST_MENU`'s order places it: the acts first — Save, Cite,
   the opinion, the reply, then Remove as the last of them, where the post's
   menu puts it after its own acts — and the readings after, the license
   closing the sheet.

   STILL NO EDIT ROW. Messages never edit (chats.md §8): a correction is the
   next message, and removing is the whole of what an author may take back.

   THE MESSAGE HELD is the reader's own plaintext one, `Crust held all the way
   past the slipway today.` — the thread beneath is `ChatThread`'s, whole and
   inert. */
export function Screen() {
  return (
    <>
      <ChatThreadBody />
      <BottomSheet open ariaLabel="Message actions">
        <SheetItem label="Save" />
        <SheetItem label="Cite in a new post" />
        <SheetItem label="Give your opinion" />
        <SheetItem label="Reply" />
        <SheetItem label="Remove" />
        <SheetItem label="Cited by" />
        <SheetItem label="Opinions on this" />
        <SheetItem label={LICENSE_MENU_LABEL} />
      </BottomSheet>
    </>
  );
}

/* REMOVE THIS MESSAGE? — the think-twice dialog behind your own message's
   `Remove` (round B3 of the chats work, the integration round).

   THE POST'S CONFIRM WITH THE NOUNS SWAPPED (canonical's `RemoveConfirm`, the
   confirm-nouns rule): what goes, what stays in its place in the mark's own
   words, and that it is immediate and permanent. The safe answer is the filled
   one and `Remove` carries no colour — a removal is not an error (jakob
   2026-09-15, on the post's).

   ONE SENTENCE A POST DOES NOT NEED: a message is often quoted, so the dialog
   says the replies keep pointing at its place. A message has no versions, so
   the post's "every earlier version's" is not said.

   A MESSAGE THE READER SENT ENCRYPTED IS REMOVED THE SAME WAY — removal never
   needs plaintext (chats.md §7) — and the dialog does not change.

   THE SURFACE BENEATH IS THE THREAD, whole and inert. */
export function Screen() {
  return (
    <>
      <ChatThreadBody />
      <DialogSurface
        onScrimPress={() => {}}
        title="Remove this message?"
        body={[
          "Its words and anything it carries leave every reader's view. A visible mark stays in their place — “Removed by its author” — and replies to it keep pointing there.",
          "This is immediate and permanent.",
        ]}
        actions={
          <>
            <Button variant="text">Remove</Button>
            <Button>Keep it</Button>
          </>
        }
      />
    </>
  );
}

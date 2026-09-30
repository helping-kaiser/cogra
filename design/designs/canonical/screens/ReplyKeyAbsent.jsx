/* THE KEY ELSEWHERE, MET AT THE REPLY'S DOOR (the reply pack, jakob
   2026-09-30: "key-absent gated at the door"; audit K6.3). A reply keeps no
   draft, so a reply written with the key elsewhere could only be lost at the
   seal. The notice therefore comes BEFORE a word is written: Reply on a
   comment, or Add a comment, raises this over the thread instead of opening
   the composer.

   IT IS `PadKeyAbsent`'S CARD WITHOUT THE PAD. The pad opens anyway because a
   pick can be kept pending; a reply cannot, so there is no thinking to allow
   first and nothing to keep. What stays is the pattern's notice — the
   `tertiary-container` panel with its "?" naming the key and the restore
   button in `Button`'s `inverse` (`KeyAbsentNotice`) — and one text button
   under it, on the house dialog's surface, because nothing on the thread
   anchors it the way a stance face anchors a pad.

   `Not now` IS THE WAY OUT, and the press outside is the same answer: the
   thread comes back exactly as it was, nothing written, nothing kept. There
   is no "keep it pending" here, because there is nothing to keep.

   For a reader with no backup the notice takes `KeyElsewhereNoBackup`'s two
   changes, like every key-absent notice: the no-backup sentence in place of
   the line, and no restore button — `Not now` alone stays.

   THE THREAD BENEATH IS `ReplyEntry`'s, whole and inert under the wash; its
   controls are wired there. The dialog is lifted above the sheet by one
   layer of board glue: `DialogSurface` sits on the base wash layer and the
   sheet one above it, and the notice is the thing raised last. */
export function Screen() {
  return (
    <>
      <ThreadDetail />
      <CommentsThreadSheet />

      <div style={{ position: "fixed", inset: 0, zIndex: 43 }}>
        <DialogSurface ariaLabel="Your key isn't on this browser">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <KeyAbsentNotice line="A reply can't wait as pending — restore the key before you write." />
            <Button variant="text" style={{ width: "100%" }}>Not now</Button>
          </div>
        </DialogSurface>
      </div>
    </>
  );
}

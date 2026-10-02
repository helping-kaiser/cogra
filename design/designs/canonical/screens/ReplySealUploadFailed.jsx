/* THE REPLY'S GATED SEAL, WHEN AN UPLOAD FAILS (jakob's ruling, the night
   batch 2026-10-01 — audit K6.2). `ReplySealUploading` with the gate's fault
   reading: one of the reply's pictures did not reach CoGra while the reader
   waited on the seal.

   A FAILED UPLOAD IS A FAULT, NOT A REFUSAL (`ReplyVideoFailed`'s reasoning):
   the file was fine and the network was not, so the way out is `Retry`, and
   the gate line says what it is waiting for — `One picture didn't upload.
   Signing waits for it.` `Sign comment` stays disabled. A press held at the
   gate drops here (jakob 2026-10-02, the residue round's Q5): the label reads
   `Sign comment` again, the ways out answer again and nothing signs. `Retry`
   starts the upload again and the line returns to its running reading; the
   reader presses again once it is running. There is no
   `Remove it` on the seal: the seal reads back, and what the reply carries is
   changed one stage back, where the failed tile wears its badge.

   A PATTERN EXEMPLAR (readme §13, *Canvas pages and flows*): only the gate's
   Retry and the gated commit are this board's own; the rest is `ReplySeal`'s,
   wired on that board. */
export function Screen() {
  return <ReplySealBody uploading={{ failed: true }} />;
}

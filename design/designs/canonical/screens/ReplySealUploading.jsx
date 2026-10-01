/* THE REPLY'S SEAL, GATED ON ITS PICTURES (jakob's ruling, the night batch
   2026-10-01 — audit K6.2). `Next` pressed while a reply's media is still going
   up reaches this seal — the reply's own, never the post's. The post's gated
   seal says `Sign and publish`, reads one axis, offers no add-rows, backs into
   the post wizard and leaves with "draft kept"; a reply keeps no draft, so
   every one of those would be a wrong word or a wrong way back here.

   IT IS `ReplySeal` WITH THE GATE OVER THE FOOT. `ReplySealBody` at
   `uploading`: the read-back, the acts card with its add-rows, the three
   facts, the note — unchanged — and `UploadStatusLine` above `Sign comment`,
   which is disabled while the line shows: nothing signs until the content it
   signs exists. The header's X is the reply's own, `Leave — the reply is
   discarded`, through `DiscardConfirm` as from every reply stage.

   THE GATE CAN FAIL. An upload that does not land while the reader waits here
   turns the line into its fault reading (`ReplySealUploadFailed`): the fact,
   `Signing waits for it.` and Retry.

   A PATTERN EXEMPLAR (readme §13, *Canvas pages and flows*): only the gated
   commit is this board's own; the header, the acts card and the rows are
   `ReplySeal`'s controls, wired on that board. */
export function Screen() {
  return <ReplySealBody uploading={{ done: 1, total: 2 }} />;
}

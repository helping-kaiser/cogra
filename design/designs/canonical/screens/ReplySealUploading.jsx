/* THE REPLY'S SEAL, GATED ON ITS PICTURES (jakob's ruling, the night batch
   2026-10-01 — audit K6.2). `Next` pressed while a reply's media is still going
   up reaches this seal — the reply's own, never the post's. The post's gated
   seal says `Sign and publish`, reads one axis, offers no add-rows, backs into
   the post wizard and leaves with "draft kept"; a reply keeps no draft, so
   every one of those would be a wrong word or a wrong way back here.

   IT IS `ReplySeal` WITH THE GATE OVER THE FOOT. `ReplySealBody` at
   `uploading`: the read-back, the acts card with its add-rows, the three
   facts, the note — unchanged — and `UploadStatusLine` above `Sign comment`:
   nothing signs until the content it signs exists. The header's X is the
   reply's own, `Leave — the reply is discarded`, through `DiscardConfirm` as
   from every reply stage.

   THE GATE NAMES ITS CONTENT (jakob 2026-10-02, pads 3): a clip from
   `ReplyVideo` reads `…signing waits for the video.`, pictures `…for the
   pictures.`

   THE COMMIT STAYS ENABLED THROUGH THE GATE (jakob 2026-10-02, the fix-fix
   round's 20), drawn as it is at rest. Pressed, its label swaps in place to
   `Signing comment…` — the failure pack's label-swap idiom (`SealFooter`'s
   `busy`), the ways out locked with it — and signing proceeds the moment the
   bytes land; no second press is asked.

   THE GATE CAN FAIL. An upload that does not land while the reader waits here
   turns the line into its fault reading (`ReplySealUploadFailed`): the fact,
   `Signing waits for it.` and Retry.

   A PATTERN EXEMPLAR (readme §13, *Canvas pages and flows*): only the gated
   commit is this board's own; the header, the acts card and the rows are
   `ReplySeal`'s controls, wired on that board. */
export function Screen() {
  return <ReplySealBody uploading={{ done: 1, total: 2 }} />;
}

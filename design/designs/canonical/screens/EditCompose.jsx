/* EDIT A POST (legacy conversion, lane C): one screen, one batch. Everything
   the edit changes — the words, the tags added and withdrawn, the citations
   — signs together, and `ActsFooter` says how much before the button does it.

   IT IS `EditComposeVideo`'s TEXT-AND-PICTURES TWIN, and `CommentEdit` at post
   scale: same header with its one "?", same fields, same tags and references
   blocks, same locked license, same foot. The picture body arrives as
   `PickedRow` — the whole row opens Show all — because a post being edited is
   a post being composed with its answers already filled in.

   THE BODY EDITS LIKE A COMPOSER'S, because an edit carries complete state:
   the row's manager reorders, recovers the cover, removes and describes, and
   "+ Add pictures · 2 of 10" takes more. The two together are the whole of
   what the ruling asked for — the body may end up a different KIND than the
   one that was published, and the manager is where that begins.

   THE LICENSE IS LOCKED, and the lock is a mark rather than an action: a
   licence is published with the post and never changes, so the row shows what
   was declared and says why nothing can be done about it.

   A WITHDRAWAL READS BACK WHERE THE THING STOOD, WITH ITS `Undo` (jakob's
   ruling, the night batch 2026-10-01 — audit K5.3). A tag taken off and a
   citation removed are acts in the batch — the acts sheet counts them — so
   each leaves a `Withdrawn:` line under its block, one per item, and the
   line's `Undo` unstages that withdrawal. Re-picking the same name in a picker
   does the same; it never stages a second, cancelling record.

   A CITATION'S WITHDRAWAL COUNTS ITS REAL RECORDS. It is the severance shape —
   the counter-records that net the bundle to (0, 0), each its own priced act —
   so it adds `ReferenceClaim.withdrawalCost` to the count, possibly more than
   one: the citation drawn withdrawn here was revised past 1 and stages two,
   which is why the foot reads five. Sign is the confirmation (jakob): the
   count is said on the foot and in the acts sheet, and no dialog asks again.

   A STANDING CITATION WHOSE TARGET WAS REMOVED WEARS THE REMOVED-MARK FACE
   (jakob 2026-10-05, the 134 residue's 3a), `KeptPicksReview`'s face and words
   unchanged: the tile empty, `Removed by its author` in the name's place in
   the system's voice. Nothing leaves the graph, so the citation still stands —
   its pair, its row's sheet and its × stay, and the count does not move. The
   `target` chip draws it.

   AN EDIT THAT TOOK NEW PICTURES GATES ITS SIGN ON THEIR UPLOAD (jakob
   2026-10-05, the 134 residue's 3b) — the seal's grammar unchanged
   (`ComposeSealUploading`). `UploadStatusLine` stands over the foot and `Sign
   the edit` stays enabled. Pressed, its label swaps in place to `Signing the
   edit…`, the ways out locked with it, and signing proceeds the moment the
   bytes land, with no second press. An upload that fails drops the held press:
   the line takes its fault reading — `One picture didn't upload. Signing waits
   for it.` with `Retry` — `Sign the edit` reads itself again, disabled until
   `Retry` re-gates, and the reader presses again. The `upload` chip's
   `uploading` draws the running gate, and the second tile wears the compose
   row's upload ring (jakob 2026-10-05: the edit's row is the compose row).

   THE FIXTURE'S STORY (jakob 2026-10-05, the 136 round's 5a): both pictures
   in the row were added in this edit. A picture the post already carried
   never uploads again, so the gate counts the new ones alone, and `Uploading
   1 of 2` is true of this row: the first has landed, the second is going up.

   A FAILED UPLOAD MARKS ITS TILE TOO (jakob 2026-10-05, the 136 round's 2).
   The edit's media row is the compose media row, so it fails the compose way
   — the tile wears `MediaThumb`'s badge and `One picture didn't upload.`
   stands under the row with `Retry · Remove it` (`ComposeUploading`) — and,
   in addition, the gate line takes its fault reading and `Sign the edit` is
   disabled. `Remove it` on the failed new picture un-gates Sign: nothing is
   left to upload. The `upload` chip's `failed` draws the three together, the
   second picture the one that failed.

   PAST 5s THE SLOW LINE STANDS UNDER THE COUNT (jakob 2026-10-05, the 136
   round's 1). An edit has no acts card, so `ActsFooter` carries the seals'
   line as its subline, `Still signing — the network is slow right now.`,
   counted from the press and gone when the signing answers, with `Sign the
   edit` reading `Signing the edit…` and the ways out locked, undimmed, as on
   `SealSigningSlow`. It holds for every edit's signing, gated or not, and for
   all five edit boards; this chip draws it once. The `signing` chip's `slow`
   draws it; with `upload` at `failed` it draws nothing, because a failed
   upload drops the held press.

   THE BODY IS `_shared.jsx`'s `EditComposeBody`, because the acts sheet stands
   on this edit and draws it whole. */
export const PROPS = {
  target: { editor: "enum", options: ["live", "removed"], default: "live" },
  upload: { editor: "enum", options: ["none", "uploading", "failed"], default: "none" },
  signing: { editor: "enum", options: ["none", "slow"], default: "none" },
};
export const VALS = `liveShown: this.props.target === "removed" ? "none" : "block", removedShown: this.props.target === "removed" ? "block" : "none", gateShown: this.props.upload === "uploading" ? "block" : "none", rowShown: this.props.upload === "none" ? "block" : "none", rowUploadingShown: this.props.upload === "uploading" ? "block" : "none", rowFailedShown: this.props.upload === "failed" ? "block" : "none", errorShown: this.props.upload === "failed" ? "block" : "none", gateFailedShown: this.props.upload === "failed" ? "block" : "none", footQuietShown: this.props.signing === "slow" && this.props.upload !== "failed" ? "none" : "flex", footSlowShown: this.props.signing === "slow" && this.props.upload !== "failed" ? "flex" : "none", signRestShown: this.props.signing !== "slow" && this.props.upload !== "failed" ? "block" : "none", signBusyShown: this.props.signing === "slow" && this.props.upload !== "failed" ? "block" : "none", signFailedShown: this.props.upload === "failed" ? "block" : "none"`;

export function Screen() {
  return <EditComposeBody holes />;
}

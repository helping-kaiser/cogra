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
   A citation this app cannot type stands in `References` as a row with no ×
   and opens nothing — api-spec excludes it from editing — and its note reads
   `Comes along as it is.` (jakob 2026-10-02, pads 2).

   THE BODY IS `_shared.jsx`'s `EditComposeBody`, because the acts sheet stands
   on this edit and draws it whole. */
export function Screen() {
  return <EditComposeBody />;
}

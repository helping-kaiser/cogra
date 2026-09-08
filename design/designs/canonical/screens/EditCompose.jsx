/* EDIT A POST (legacy conversion, lane C): one screen, one batch. Everything
   the edit changes — the words, the topics added and withdrawn, the citations
   — signs together, and `ActsFooter` says how much before the button does it.

   IT IS `EditComposeVideo`'s TEXT-AND-PICTURES TWIN, and `CommentEdit` at post
   scale: same header with its one "?", same fields, same topics and references
   blocks, same locked license, same foot. The picture body arrives as
   `PickedRow` — the whole row opens Show all, the way the compose wizard's
   details stage does — because a post being edited is a post being composed
   with its answers already filled in.

   THE LICENSE IS LOCKED, and the lock is a mark rather than an action: a
   licence is published with the post and never changes, so the row shows what
   was declared and says why nothing can be done about it.

   THE WITHDRAWN LINE IS A NOTE, not a control. A topic taken off is still an
   act in the batch — the acts sheet counts it — but there is nothing to press
   on the word itself, so it reads as the small true line it is.

   THE BODY IS `_shared.jsx`'s `EditComposeBody`, because the acts sheet stands
   on this edit and draws it whole. */
export function Screen() {
  return <EditComposeBody />;
}

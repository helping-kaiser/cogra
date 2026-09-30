/* THE REPLY COMPOSER AIMED AT A COMMENT (the reply pack, jakob 2026-09-30;
   audit K6.1). Reply on a comment opens the same full-focus composer
   `ReplyCompose` draws, pre-targeted at that comment — one commenting
   mechanism over many targets, so this is that composer and not a second one.

   ONLY THE QUOTE DIFFERS. `QuotedRow` holds what is answered above the answer;
   a comment has no title, so the row's first line is its author's handle and
   the second is how the comment starts. Everything else is `ReplyDraft`
   unchanged — the header, the words, "+ Add pictures or a video", the foot.

   NOTHING IS PRE-FILLED. The words do not open with `@tobias`: a typed handle
   is text, never a record, and the quote above already says what is being
   answered. The thread shows the answer under the comment it answers. */
export function Screen() {
  return <ReplyDraft target="comment" />;
}

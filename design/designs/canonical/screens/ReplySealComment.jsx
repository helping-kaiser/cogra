/* THE REPLY'S SEAL AIMED AT A COMMENT (the reply pack, jakob 2026-09-30;
   audit K6.1). `ReplySeal` answering a comment instead of a post: the same
   header, acts card, add-rows, three facts, note and foot — `ReplySealBody`
   at `target="comment"`.

   TWO LINES NAME THE TARGET, AND ONLY THOSE CHANGE. The read-back says
   `Reply to @tobias`, and the act row `Reply to @tobias's comment` — a comment
   named by its author, the way `QuotedRow` names it one stage back. Every
   other word on the seal serves both targets: the stance row is `Toward what
   you answer`, and the note under the ruled block says `Replying also signs
   an opinion on what it answers.` — an opinion, never "your opinion", because
   the reply's own starts at the default and rides the reply (jakob).

   THE PAD IS THE SAME PAD. `ReplyPad`'s readout says `Toward what you answer`
   whatever is answered, so no second pad is drawn: Adjust opens `ReplyPad`,
   and its Set returns here. */
export function Screen() {
  return <ReplySealBody target="comment" />;
}

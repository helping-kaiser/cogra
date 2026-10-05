/* THIS SHOULDN'T HAVE HAPPENED (jakob 2026-10-01) — the seal after the
   signing was refused for one staged act, in every case but the one
   `SealFaultRow` draws. The picking stage only offers targets that answer;
   a refusal of a picked target that did land is therefore a bug the picker
   should have blocked, and the seal says so in that register.

   A DIFFERENT REGISTER FROM A FAULT, AND FROM THE WRITE RULE. Not
   `TransportError`'s `--error` line: the reader did nothing wrong, and a red
   line would hand them a failure that is ours. Not the write rule's words
   either: that notice is a rule working as meant, and this is the system
   telling on itself. It is the tertiary `NoticePanel` — the honesty idiom,
   for a state where nothing was staged, signed or spent — and its words own
   the fault plainly: `This shouldn't have happened`, then that it is a fault
   on our side, that nothing was signed or spent, and that telling us helps.

   THREE WAYS OUT, AS RULED. `Try again`, filled in `Button`'s `inverse`, the
   panel's own act: unlike a refusal by rule, a bug can be transient — what
   this device read may not have caught up — so asking again is a real way
   out here, where `RefusedFile`'s rule withholds Retry from a refusal that
   cannot change. `Report a problem` opens `ReportProblem`, the same sheet
   Settings opens. `Discard the post` asks first (`SealDiscardConfirm`), the
   undo-vs-confirm rule's instance for losing a draft. A reply's or an edit's
   seal takes the same construction with its own noun: `Discard the reply`,
   `Discard the edit` — the post edit's included, asking first in the comment
   edit's words, `Discard the changes?` (flagged). A seal with no draft to
   lose takes `Not now` instead, one stage back with everything as it was
   (jakob 2026-10-05, the collected brief's D8): the kept picks' seal, back to
   the review with every pick still kept, and — drafted, flagged — the
   profile's seal, back to the edit, and the picture's, back to the crop.

   NO ROW IS MARKED. The contract names the refused entry, but a line on that
   row would say the reader's pick is the problem and invite them to fix it —
   and this register exists because it is not theirs to fix. Every row reads
   back exactly as before.

   THE HEADER'S "?" STAYS THE ONLY ONE. The stopper exception lets a stopper's
   notice carry its own; this panel has nothing a dialog would add, because
   the report is the explanation that matters, and it is a door on the
   surface already. */
export function Screen() {
  return <ComposeSealBody state="bug" />;
}

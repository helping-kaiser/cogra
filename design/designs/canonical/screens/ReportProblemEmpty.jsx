/* REPORT A PROBLEM, BEFORE A WORD (jakob 2026-10-01, closing backlog item
   118's first question) — the state the page opens in: the field empty, and
   `Send by email` waiting on it.

   VISIBLE AND DISABLED, WITH THE REASON ON SCREEN — the disabled-submit law
   (readme §4, *Interaction states*), the one the edit wizards and the seal
   already keep: the reader sees the commitment exists and reads what it waits
   for, so a disabled button reads as a state and never as a fault. The reason
   sits in the foot's line right above the commit, where the eye already goes:
   `Nothing to send yet`, the edit foot's zero (`EditComposeUnchanged`'s
   `Nothing to sign yet`) with the report's verb. `yet` does the same work it
   does there — nothing is wrong, and the first word typed wakes the button.

   EVERYTHING THAT TRAVELS IS STILL READ BACK. The four facts and the note under
   them do not wait on the words: what goes with a report is true before
   anything is written, and saying it first is the honesty register's point.

   THE PAGE IS `ReportProblemBody`, one prop apart from `ReportProblem`: an
   empty report is a state of that screen, not a second screen. */
export function Screen() {
  return <ReportProblemBody />;
}

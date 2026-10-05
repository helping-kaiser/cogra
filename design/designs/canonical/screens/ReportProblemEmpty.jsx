/* REPORT A PROBLEM, BEFORE A WORD (jakob 2026-10-01, closing backlog item
   118's first question) — the state the page opens in: the field empty.

   `SEND BY EMAIL` IS LIVE FROM AN EMPTY FIELD (jakob 2026-10-05, the
   collected brief's D6). The disabled-until-filled law (readme §4,
   *Interaction states*) gates commits; a handoff that only prefills another
   app's draft is not a commit. The press opens the reader's own mail, where
   they can write — or delete — anything; what this page adds is the spec
   prefill, the four facts below, and that travels whatever the field holds.
   Forcing the words to be typed here first would enforce nothing.

   EVERYTHING THAT TRAVELS IS STILL READ BACK. The four facts and the note under
   them do not wait on the words: what goes with a report is true before
   anything is written, and saying it first is the honesty register's point.

   THE PAGE IS `ReportProblemBody`, one prop apart from `ReportProblem`: an
   empty report is a state of that screen, not a second screen. */
export function Screen() {
  return <ReportProblemBody />;
}

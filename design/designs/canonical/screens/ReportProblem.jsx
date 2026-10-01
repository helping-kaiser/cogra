/* REPORT A PROBLEM (the support stack, jakob 2026-10-01) — what Settings'
   `Report a problem` row opens, and the door the seal's bug register offers
   (`SealFaultBug`). One screen for both: the report carries the reader's
   words, never the place it was opened from.

   ONE FIELD, IN THE READER'S OWN WORDS. `What happened`, a multi-line field
   that opens at four lines and grows — `rows` is a minimum (the growth law,
   readme §13, *The sheets-and-video round*). No category picker and no
   severity: the reader says what happened, and sorting it is ours to do.

   YOU SEE EXACTLY WHAT TRAVELS — the honesty register. The send goes out
   through the reader's own mail (a `mailto:` on the web, the system's send
   on the app), so before it is pressed the screen reads back everything that
   goes with the words, in `FactRow`'s seal list — the list a reader checks
   before putting their name on something: where it goes, the version, what
   it is running on, and the time. Nothing else is attached — no account, no
   key, nothing posted — and the line under the list says so, and says the
   one thing the mail itself adds: the reader's own address, so we can write
   back.

   THE ADDRESS IS A PLACEHOLDER until CoGra is on a server (jakob: "we have
   placeholders until we have a server"), the APK path's way: real-shaped,
   on the repo's own `.local` domain, swapped when the address exists.

   THE COMMIT SAYS WHERE IT GOES. `Send by email`, because the press opens
   the reader's mail with all of this filled in and nothing leaves until they
   send it there; a bare `Send` would promise a delivery this screen does not
   make. The words are platform-independent, one string for app and web.

   THE TWO-PLACEMENT LAW'S STATED EXCEPTION (readme §4, *Spacing and
   layout*; jakob 2026-10-01). The commit does not follow the field: the
   read-back of what travels stands between them, so the reader sees
   everything that goes before the press.

   THE FIELD'S TWO EDGES (jakob 2026-10-01, closing backlog item 118's first
   question). Empty, `Send by email` is visible and disabled with the reason
   right above it (`ReportProblemEmpty`) — the disabled-submit law. And
   leaving with Back keeps the words: a report the reader walked away from is
   there again the next time the page opens, as a post's draft is kept, so
   nothing written is lost to a stray tap.

   THE FIXTURE is a report written from the bug register, so the two boards
   read as one moment; the platform value is the settings page's own session
   fixture. A TASK PAGE: the back arrow and no bottom bar. The page is
   `ReportProblemBody`, shared with its empty state. */
export function Screen() {
  return (
    <ReportProblemBody words="I tried to post with a citation and the seal said this shouldn't have happened. Try again said the same thing." />
  );
}

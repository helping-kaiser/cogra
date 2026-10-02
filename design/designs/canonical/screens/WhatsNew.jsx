/* WHAT'S NEW — the release chronicle behind Settings' `What's new` row (the
   support stack, jakob 2026-10-01).

   THE SYSTEM'S CHRONICLE, APPLIED TO THE PRODUCT ITSELF (readme §13, *The
   change-histories round*): one list of whole versions, newest first, the
   current one marked in its own dateline rather than lifted above the list.
   A release is drawn the way a version is — a dateline, then the thing
   itself — and never as a diff against the one before.

   THE DATELINE SPEAKS THE AGES LAW: history is a date, `dd.mm.yyyy`, and the
   version is named whole. The marked one is the version running here,
   `installed` (curate 1), the same value the settings row reads, so the row
   and the page cannot disagree.

   EACH RELEASE'S NOTES ARE PLAIN WORDS about what a reader can now do, and
   the page is where they are read: no release sends the reader elsewhere
   (jakob 2026-10-02 — a reader wants the new version, not the code). The
   words are platform-independent; the app and the web read one list.

   THE NOTES ARE FIXTURE, NOT COPY. What each release says is written when it
   ships; the board draws the shape a release's notes take.

   A RUNNING VERSION BEHIND THE NEWEST (jakob 2026-10-01) gains one quiet
   line atop the list and its `Update now` (`WhatsNewBehind`); this board is
   the running version the newest one.

   A TASK PAGE: the back arrow and no bottom bar, like every page Settings
   opens. The page is `WhatsNewBody`, shared with its behind state. */
export function Screen() {
  return <WhatsNewBody />;
}

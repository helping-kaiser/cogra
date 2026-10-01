/* WHAT'S NEW, WITH A NEWER VERSION OUT (jakob 2026-10-01, backlog item 118:
   "for sure the versions should tell you that there is a newer version").
   `WhatsNew` while the version running here is behind the newest release.

   ONE QUIET LINE, ATOP THE LIST. `A newer version exists.` in the page's
   secondary ink, ending in the door onto that release's public page, `See it
   on GitHub` — `ProfileMoreFailed`'s line shape, a fact and the one thing to
   do about it on one line. Nothing else changes: no badge, no banner, no
   forced update. The words are drafts flagged for blessing (copy-voice, *The
   settings page*, About).

   THE PAGE IS ONE OF TWO SURFACES. The other is the once-per-release
   snackbar on a cold open's feed (`FeedNewerVersion`), whose action opens
   this page.

   THE CHRONICLE IS THE ONE THE RUNNING APP KNOWS: the newer release's notes
   are behind its door, not drawn into the list here. */
export function Screen() {
  return <WhatsNewBody newer={NEWER_VERSION} />;
}

/* WHAT'S NEW, WITH A NEWER VERSION OUT (jakob 2026-10-01, backlog item 118:
   "for sure the versions should tell you that there is a newer version").
   `WhatsNew` while the version running here is behind the newest release.

   ONE QUIET LINE, ATOP THE LIST. `A newer version exists.` in the page's
   secondary ink, ending in `Update now` — `ProfileMoreFailed`'s line shape, a
   fact and the one thing to do about it on one line. Nothing else changes: no
   badge, no banner, no forced update.

   `Update now` LEADS TO THE DOWNLOAD (jakob 2026-10-02: "most users want to
   receive the new version and not check out the code"). In the app it opens
   CoGra's Play Store listing — a placeholder id until the app is published,
   like the `.local` addresses (F2); on the web, where there is no store, the
   same button reloads the page into the new version (F1). One string for
   both, with no platform noun. The What's new page stays the notes page.

   THE DATELINES SAY WHAT EACH VERSION IS TO THIS DEVICE (curate 1): the newer
   release heads the list as `newest`, the running one reads `installed` —
   never `current`, which a version behind the newest is not.

   THE PAGE IS ONE OF TWO SURFACES. The other is the once-per-release
   snackbar on a cold open's feed (`FeedNewerVersion`), whose action is the
   same `Update now`. */
export function Screen() {
  return <WhatsNewBody newer={NEWER_RELEASE} />;
}

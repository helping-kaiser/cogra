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

   EVERY RELEASE CARD KEEPS ITS DOOR (jakob 2026-10-02, the fix-fix round's
   ruling 0), the newest one's included: `See it on GitHub`, named for its
   release, onto that release's public page (`WhatsNew`'s anatomy). The
   cards are the only way to the code; `Update now` never leads there.

   THE DATELINES SAY WHAT EACH VERSION IS TO THIS DEVICE (curate 1): the newer
   release heads the list as `newest`, the running one reads `installed` —
   never `current`, which a version behind the newest is not.

   THE PAGE IS ONE OF TWO SURFACES. The other is the once-per-release
   snackbar on a cold open's feed (`FeedNewerVersion`), whose action is the
   same `Update now`.

   REGISTERED under `WhatsNew`'s `whatsNew` prefix (design ⇄ impl seam 089):
   the same page, so the same paths, plus the line's `newerLine` and its
   `update`; the newer release joins under its own version's key. */
export const NODE = "whatsNew";
export function Screen() {
  return <WhatsNewBody newer={NEWER_RELEASE} />;
}

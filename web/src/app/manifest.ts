import type { MetadataRoute } from "next";

/**
 * The web app manifest — what makes the app installable to a home screen
 * (Next's `manifest.ts` file convention; it serves `/manifest.webmanifest`
 * and links it from every page's head).
 *
 * The members are exactly Chromium's install criteria (web.dev
 * "What does it take to be installable?"): a name, a 192px and a 512px icon,
 * `start_url`, and a standalone `display`. No service worker: install no
 * longer requires one.
 *
 * THERE IS NO `theme_color`, ON PURPOSE. On a phone the theme colour is
 * painted into the status bar (MDN, "Customize your app's theme and
 * background colors"), and the app never colours the system status bar —
 * leaving it out keeps the bar the browser's own. Nothing in the head sets
 * a `theme-color` meta either, for the same reason.
 *
 * `background_color` is the ground the phone shows before the stylesheet
 * loads (the launch splash on Android), so it is the light theme's
 * `background` role — pinned to `design/tokens/scheme.json` by
 * `manifest.test.ts`, never trusted as a transcription.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "CoGra",
    short_name: "CoGra",
    description: "The CoGra web app.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fff8f6",
    icons: [
      // The tile (`icon.svg`, rounded) where a platform shows the icon as is.
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android's adaptive launcher icon, full-bleed, for launchers that cut
      // their own shape — the installed web app wears the native app's icon.
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

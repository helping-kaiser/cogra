// `Update now` in the app (WhatsNewBehind.md:15; FeedNewerVersion.md:19):
// CoGra's Play Store listing — the download, never the release's GitHub
// page. The id is the staged placeholder (`STORE_LISTING_URL` in the design's
// `_shared.jsx`; design/staged-surfaces.md) until CoGra is published, when it
// swaps for the real listing (backlog item 118).
//
// Not the Play In-App Updates API: its immediate flow is a blocking update
// UI, against "no update is ever forced" (FeedNewerVersion.md), and its
// flexible flow is a different surface from the drawn hand-off.

package com.cogra.app.navigation

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import androidx.core.net.toUri

/** The listing's application id, staged until publication. */
const val STORE_LISTING_ID = "local.cogra.app"

/**
 * Opens the listing in the store app, or in the browser when no store app
 * handles `market://` (Android developers, "Linking to Google Play").
 */
fun openStoreListing(context: Context) {
    val store = Intent(Intent.ACTION_VIEW, "market://details?id=$STORE_LISTING_ID".toUri())
    try {
        context.startActivity(store)
    } catch (ignored: ActivityNotFoundException) {
        try {
            context.startActivity(
                Intent(Intent.ACTION_VIEW, "https://play.google.com/store/apps/details?id=$STORE_LISTING_ID".toUri()),
            )
        } catch (ignored: ActivityNotFoundException) {
            // No store and no browser: nothing to open, and nothing is forced.
        }
    }
}

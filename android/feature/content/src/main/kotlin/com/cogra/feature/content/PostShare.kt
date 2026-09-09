// Handing a post to the platform's own share sheet
// (`design/components/content/ShareButton.jsx`, readme §13's reel
// round).
//
// ONE TAP, NO SURFACE OF OUR OWN. The sheet belongs to the OS — it is
// where the reader's own apps and contacts live, and a share menu drawn
// here would be a worse copy of it that also knows less. So the control
// has no state, no confirmation and no menu: it is the handoff.

package com.cogra.feature.content

import android.content.Context
import android.content.Intent

/**
 * What the reader hands on: the post's page on the web, not an in-app
 * route, because whoever receives it may not have the app. It is the
 * same address the app's own deep links answer.
 */
internal fun postShareUrl(webOrigin: String, postId: String): String =
    "$webOrigin/posts/$postId"

/**
 * The handoff itself — `ACTION_SEND` wrapped in the system chooser, the
 * platform's documented way to share plain text. No title on the
 * chooser: Android draws its own, and one of ours would be a second
 * label saying the same thing.
 */
internal fun Context.sharePost(url: String) {
    val send = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, url)
    }
    startActivity(Intent.createChooser(send, null))
}

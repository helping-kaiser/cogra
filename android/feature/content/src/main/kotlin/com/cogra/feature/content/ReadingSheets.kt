// THE READINGS A MENU RAISES (CommentMenu.md:23-27; ReaderPostMenu.md:31-35):
// a menu's reading rows open a sheet over the surface the menu was opened on,
// and every host mounts them the same way — one piece of state saying which
// reading is up, and this one mount. A host that grew a flag and a sheet per
// reading would be a different host for every row.

package com.cogra.feature.content

import androidx.compose.runtime.Composable
import com.cogra.core.designsystem.v2.media.CoverKind
import com.cogra.core.designsystem.v2.media.CoversSurface

/** Which reading a menu row raised. */
internal enum class Reading {
    /** What cites the node (CitedBy.md). */
    CitedBy,
}

/**
 * How a host wears its reading sheets.
 *
 * @param onOpenPost a Cited by row's door: the citing post, or the post a citing
 *   comment answers (CitedBy.md:15).
 * @param stacked the thread's door: the sheet stands over the thread's own
 *   sheet at the default class (CommentCitedByEmpty.md:3).
 * @param registered the host the boards register the sheets on — the post
 *   detail (`postDetail.citedBySheet`); elsewhere the sheets keep their tags.
 * @param testTagPrefix the tags' prefix where the sheet is not registered.
 * @param suspendsVideo a sheet over a page stops the clip beneath it, as the
 *   page's other sheets do; the thread's own clips answer to the thread.
 */
internal class ReadingHost(
    val onOpenPost: (String) -> Unit,
    val testTagPrefix: String,
    val stacked: Boolean = false,
    val registered: Boolean = false,
    val suspendsVideo: Boolean = true,
)

/** The sheet [reading] names for [nodeId], or nothing while no reading is up. */
@Composable
internal fun ReadingSheet(reading: Reading?, nodeId: String?, host: ReadingHost, onDismiss: () -> Unit) {
    if (host.suspendsVideo) CoversSurface(open = reading != null, kind = CoverKind.Suspend)
    if (nodeId == null) return
    when (reading) {
        Reading.CitedBy -> CitedBySheet(
            nodeId = nodeId,
            onDismiss = onDismiss,
            onOpenPost = host.onOpenPost,
            stacked = host.stacked,
            node = CITED_BY_SHEET.takeIf { host.registered },
            testTag = "${host.testTagPrefix}_cited_by_sheet",
        )
        null -> Unit
    }
}

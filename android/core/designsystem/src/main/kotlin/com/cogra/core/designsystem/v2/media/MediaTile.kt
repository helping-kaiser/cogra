package com.cogra.core.designsystem.v2.media

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import coil3.compose.AsyncImage
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.ThemePreviews

/**
 * One attachment, with **its space reserved before it loads**.
 *
 * That reservation is the component's whole reason to exist: design.md §6
 * requires that content never jumps, so the tile takes its height from
 * [MediaItem.aspectRatio] — a number the server derives from the stored bytes
 * — rather than from the decoded image. The placeholder is the reserved
 * surface itself, painted `surfaceContainerHigh`, so nothing shifts when the
 * bytes arrive and nothing flashes when they fail.
 *
 * **The 4:5 cap.** A frame taller than 4:5 is fitted whole inside a 4:5 tile
 * with the surface showing at the sides (design/readme.md §12). The bars stay
 * a plain surface: a blurred enlargement of the photo would invent image
 * where there is none, and the layout never decides the author's crop.
 *
 * **Alt text.** [MediaItem.altText] is authored, never generated. A null one
 * makes the tile decorative — a null `contentDescription` — because a
 * fabricated description is worse than none (D20).
 */
@Composable
fun MediaTile(
    item: MediaItem,
    modifier: Modifier = Modifier,
    shape: Shape = MaterialTheme.shapes.medium,
    capToTallest: Boolean = true,
    testTag: String? = null,
) {
    val tileRatio = if (capToTallest) item.aspectRatio.cappedToTallestTile() else item.aspectRatio
    val fitted = capToTallest && item.isFittedWhole()

    Box(
        modifier = modifier
            .aspectRatio(tileRatio)
            .clip(shape)
            // The reserved surface. It is visible before the load, behind a
            // letterboxed portrait, and after a failure — one painted ground
            // for all three, so none of them moves the layout.
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
    ) {
        AsyncImage(
            model = item.url,
            contentDescription = item.altText,
            contentScale = if (fitted) ContentScale.Fit else ContentScale.Crop,
            // A null description is what marks an image decorative — it keeps
            // the node out of the accessibility tree entirely, which is the
            // documented behaviour and the right answer for an asset whose
            // author wrote no alt text. Never a fabricated one.
            modifier = Modifier.fillMaxSize(),
        )
    }
}

@ThemePreviews
@Composable
private fun MediaTileRatios() {
    Cogra2PreviewTheme {
        PreviewMediaColumn {
            // Wide, square and tall all keep their own ratio.
            MediaTile(MediaItem(null, 1.91f, "A wide frame"))
            MediaTile(MediaItem(null, 1f, "A square frame"))
            MediaTile(MediaItem(null, 0.8f, "A 4:5 frame"))
            // Taller than 4:5 — fitted whole inside the cap.
            MediaTile(MediaItem(null, 0.5f, "A tall frame, fitted whole"))
        }
    }
}

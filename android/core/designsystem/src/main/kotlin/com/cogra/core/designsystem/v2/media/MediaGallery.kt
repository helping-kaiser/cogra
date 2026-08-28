package com.cogra.core.designsystem.v2.media

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.MediaOverlay
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews

/**
 * A post's body when it is pictures: one tile, or a lead tile with two
 * squares and a `+n` (design/readme.md §7.1).
 *
 * **The secondary squares crop, and only they.** They are an index into the
 * set rather than the media itself, which is the one exception
 * design/readme.md §12 makes to "the layout never decides the author's crop".
 * The lead tile keeps the post's shape and obeys the 4:5 cap like any other.
 *
 * The whole gallery is one tap target opening the post — a reader scrolling
 * is choosing between posts, not looking at one picture — so [onOpen] is a
 * single callback and the tiles below it are not individually focusable.
 *
 * The canvas has no multi-attachment board, so the internal seam is the
 * design system's own 4dp grid step rather than a measured value.
 */
@Composable
fun MediaGallery(
    items: List<MediaItem>,
    modifier: Modifier = Modifier,
    onOpen: (() -> Unit)? = null,
    shape: Shape = MaterialTheme.shapes.medium,
    testTag: String? = null,
) {
    if (items.isEmpty()) return

    val gallerySemantics = Modifier.clearAndSetSemantics {
        contentDescription = galleryDescription(items)
    }
    val root = modifier
        .fillMaxWidth()
        .then(if (onOpen != null) Modifier.clickable(onClick = onOpen) else Modifier)
        .then(if (testTag != null) Modifier.testTag(testTag) else Modifier)
        .then(gallerySemantics)

    when (items.size) {
        1 -> MediaTile(items[0], modifier = root, shape = shape)

        2 -> Row(
            modifier = root,
            horizontalArrangement = Arrangement.spacedBy(Space.x1),
        ) {
            items.forEach { item ->
                MediaTile(
                    item = item,
                    modifier = Modifier.weight(1f),
                    shape = shape,
                )
            }
        }

        else -> {
            val lead = items[0]
            val leadRatio = lead.aspectRatio.cappedToTallestTile()
            Row(
                modifier = root,
                horizontalArrangement = Arrangement.spacedBy(Space.x1),
            ) {
                MediaTile(
                    item = lead,
                    modifier = Modifier.weight(2f),
                    shape = shape,
                )
                Column(
                    modifier = Modifier
                        .weight(1f)
                        // Match the lead tile's height so the pair of squares
                        // never sets the row's height themselves.
                        .aspectRatio(leadRatio / 2f),
                    verticalArrangement = Arrangement.spacedBy(Space.x1),
                ) {
                    SecondarySquare(items[1], shape, Modifier.weight(1f))
                    Box(Modifier.weight(1f)) {
                        SecondarySquare(items[2], shape, Modifier.fillMaxSize())
                        val extra = items.size - 3
                        if (extra > 0) OverflowCount(extra, shape)
                    }
                }
            }
        }
    }
}

/**
 * A square in the index. It crops — see [MediaGallery]'s note — and it is
 * never described on its own, because the gallery above it carries the whole
 * set's description.
 */
@Composable
private fun SecondarySquare(item: MediaItem, shape: Shape, modifier: Modifier) {
    MediaTile(
        item = item.copy(aspectRatio = 1f, altText = null),
        modifier = modifier,
        shape = shape,
        capToTallest = false,
    )
}

/** `+n` over the last square, on the badge scrim so it reads over any photo. */
@Composable
private fun OverflowCount(extra: Int, shape: Shape) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MediaOverlay.Badge, shape),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "+$extra",
            style = MaterialTheme.typography.titleMedium,
            color = MediaOverlay.BadgeInk,
        )
    }
}

/**
 * One description for the whole set. Authored alt text is used where it
 * exists; the count is stated either way, so a reader always learns how much
 * is there even when nothing was described.
 */
private fun galleryDescription(items: List<MediaItem>): String {
    val described = items.mapNotNull { it.altText }
    val count = if (items.size == 1) "1 picture" else "${items.size} pictures"
    return if (described.isEmpty()) count else "$count: " + described.joinToString(". ")
}

@ThemePreviews
@Composable
private fun MediaGalleryCounts() {
    val square = MediaItem(null, 1f, "A square frame")
    Cogra2PreviewTheme {
        PreviewMediaColumn {
            MediaGallery(listOf(square))
            MediaGallery(List(2) { square })
            MediaGallery(List(3) { square })
            MediaGallery(List(7) { square })
        }
    }
}

@ThemePreviews
@Composable
private fun MediaGalleryTallLead() {
    Cogra2PreviewTheme {
        PreviewMediaColumn {
            MediaGallery(
                listOf(
                    MediaItem(null, 0.8f, "A 4:5 lead"),
                    MediaItem(null, 1f),
                    MediaItem(null, 1f),
                    MediaItem(null, 1f),
                ),
            )
            Box(Modifier.height(1.dp))
        }
    }
}

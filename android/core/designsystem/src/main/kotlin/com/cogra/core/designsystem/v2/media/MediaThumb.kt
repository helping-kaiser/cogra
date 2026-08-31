package com.cogra.core.designsystem.v2.media

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.MediaOverlay
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews

/**
 * What a thumbnail says about itself, over the picture.
 *
 * Every badge rides [MediaOverlay]'s own scrim rather than a theme surface,
 * because it has to stay legible over arbitrary pixels in both themes.
 */
sealed interface ThumbBadge {
    /** The picker's selection order: a filled counter, or an empty ring. */
    data class Order(val position: Int?) : ThumbBadge

    /** The first pick leads the post (design/readme.md §13). */
    data object Cover : ThumbBadge

    /** Removes this pick from the tray. */
    data class Remove(val onRemove: () -> Unit) : ThumbBadge

    /** A video's running time. Rendered now so 2.5.2 adds no new shape. */
    data class Duration(val label: String) : ThumbBadge

    /**
     * The upload did not go through
     * (design/components/compose/MediaThumb.prompt.md).
     *
     * The tile dims and wears this badge; its *words* live beside the row
     * in [com.cogra.core.designsystem.v2.compose.UploadErrorLine], which
     * owns Retry and Remove — "never cram retry into 48px". The two
     * always appear together, so a badge with no line is a bug.
     */
    data object Failed : ThumbBadge
}

/**
 * A square thumbnail — the picked tray's 48dp chip, the crop filmstrip's
 * frame, and the picker grid's tile are all this component at different
 * sizes.
 *
 * A thumbnail is an *index* into the set rather than the media itself, so it
 * crops. That is the same exception the gallery's secondary squares take.
 *
 * @param selected draws the filmstrip's ring.
 * @param dimmed the other half of how the canonical crop board separates a
 *   filmstrip's frames: the selected one wears the ring, the rest fade. It is
 *   a separate parameter rather than `!selected` because most uses — the
 *   picked tray, the details row — have no selection at all and must not fade
 *   everything.
 * @param size a fixed edge, or null to fill the width as a square — the
 *   picker grid sizes its tiles by its own columns, and `ComposePick` draws
 *   them flush to the seam rather than at a measured dp.
 * @param corner the tray's thumbnails are rounded; the picker grid's tiles
 *   are not, so the seam between them reads as one sheet of pictures.
 * @param width overrides [size] on one axis, for the comment composer's
 *   uncropped 70×88 frame. A comment's pictures are never cropped
 *   (2026-08-31), so their thumbnail shows the whole frame.
 * @param height the other half of [width].
 * @param fit `Crop` for an index into the set, `Fit` where the whole frame
 *   must show — the uncropped comment thumbnail's case.
 * @param uploading an upload in flight: the ring rides a scrim over the
 *   tile. Upload starts *after* the crop (only the cropped export is ever
 *   uploaded), so this is the picture's own story on its own tile.
 * @param progress how far that upload has got, where the transport can say.
 *   Null with [uploading] set draws the indeterminate ring.
 */
@Composable
fun MediaThumb(
    item: MediaItem,
    modifier: Modifier = Modifier,
    size: Dp? = Layout.ThumbSize,
    corner: Dp = Space.x2,
    badge: ThumbBadge? = null,
    selected: Boolean = false,
    dimmed: Boolean = false,
    onClick: (() -> Unit)? = null,
    contentDescription: String? = null,
    width: Dp? = null,
    height: Dp? = null,
    fit: ContentScale = ContentScale.Crop,
    uploading: Boolean = false,
    progress: Float? = null,
    testTag: String? = null,
) {
    val shape = RoundedCornerShape(corner)
    // A failed tile dims and its remove X gives way to the badge: the
    // error line beside the row owns that tile's ways out.
    val failed = badge == ThumbBadge.Failed
    val faded = dimmed || failed
    val sizing = when {
        width != null && height != null -> Modifier.size(width, height)
        size != null -> Modifier.size(size)
        else -> Modifier.fillMaxWidth().aspectRatio(1f)
    }
    Box(
        modifier = modifier
            .then(sizing)
            .then(
                if (selected) {
                    Modifier.border(BorderStroke(2.dp, MaterialTheme.colorScheme.primary), shape)
                } else {
                    Modifier
                },
            )
            .padding(if (selected) 2.dp else 0.dp)
            .clip(shape)
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .then(if (onClick != null) Modifier.clickable(role = Role.Button, onClick = onClick) else Modifier)
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier)
            .clearAndSetSemantics {
                // One node for the whole thumbnail: the badge is a property
                // of the pick, not a second control to hunt for. An upload
                // state outranks the picture's own name, because it is the
                // thing that changed and the thing that needs acting on.
                this.contentDescription = when {
                    failed -> "Didn't upload"
                    uploading && progress != null ->
                        "Uploading, ${(progress.coerceIn(0f, 1f) * 100).toInt()}%"
                    uploading -> "Uploading"
                    else -> contentDescription ?: item.altText ?: "Picture"
                }
            },
    ) {
        AsyncImage(
            model = item.url,
            contentDescription = null,
            contentScale = fit,
            modifier = Modifier
                .fillMaxSize()
                .alpha(if (faded) 0.65f else 1f),
        )
        if (uploading) UploadRing(progress)
        when (badge) {
            is ThumbBadge.Order -> OrderBadge(badge.position)
            ThumbBadge.Cover -> CoverBadge()
            is ThumbBadge.Remove -> RemoveBadge(badge.onRemove)
            is ThumbBadge.Duration -> DurationBadge(badge.label)
            ThumbBadge.Failed -> FailedBadge()
            null -> Unit
        }
    }
}

/**
 * An upload in flight: the ring on its own scrim, centred
 * (`design/components/compose/UploadNotice.jsx`'s `Ring`, on the tile).
 *
 * The scrim is what keeps a light stroke legible over arbitrary pixels —
 * the same reason every other badge here rides [MediaOverlay].
 */
@Composable
private fun BoxScope.UploadRing(progress: Float?) {
    Box(
        modifier = Modifier
            .matchParentSize()
            .background(MediaOverlay.UploadScrim),
        contentAlignment = Alignment.Center,
    ) {
        val ring = Modifier.size(RingSize)
        // White on its own scrim rather than `primary`: the ring sits on
        // arbitrary pixels, so it cannot follow the surface.
        val ink = MediaOverlay.BadgeInk
        val track = MediaOverlay.BadgeInk.copy(alpha = 0.35f)
        if (progress == null) {
            // The board draws a determinate ring, but `uploadMedia` reports
            // no byte progress — so the honest ring is the indeterminate
            // one. Drawing a made-up percentage would be a number the
            // author could not trust.
            CircularProgressIndicator(
                modifier = ring,
                color = ink,
                trackColor = track,
                strokeWidth = RingStroke,
                strokeCap = StrokeCap.Round,
            )
        } else {
            CircularProgressIndicator(
                progress = { progress.coerceIn(0f, 1f) },
                modifier = ring,
                color = ink,
                trackColor = track,
                strokeWidth = RingStroke,
                strokeCap = StrokeCap.Round,
                gapSize = 0.dp,
            )
        }
    }
}

/**
 * The failed tile's mark: an 18dp `error` dot carrying a bare `!`.
 *
 * The words are the error line's — this only says *which* tile, which is
 * the one thing 48dp can carry. The tile's remove X gives way to it, so a
 * failed picture has exactly one story and one place to act on it.
 */
@Composable
private fun BoxScope.FailedBadge() {
    Box(
        modifier = Modifier
            .align(Alignment.TopEnd)
            .padding(3.dp)
            .size(18.dp)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.error),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "!",
            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
            color = MaterialTheme.colorScheme.onError,
        )
    }
}

private val RingSize = 26.dp
private val RingStroke = 3.dp

@Composable
private fun BoxScope.OrderBadge(position: Int?) {
    val filled = position != null
    Box(
        modifier = Modifier
            .align(Alignment.TopEnd)
            .padding(6.dp)
            .size(20.dp)
            .clip(CircleShape)
            .then(
                if (filled) {
                    Modifier.background(MaterialTheme.colorScheme.primary)
                } else {
                    Modifier.border(BorderStroke(1.dp, MediaOverlay.PickerRing), CircleShape)
                },
            ),
        contentAlignment = Alignment.Center,
    ) {
        if (position != null) {
            Text(
                text = position.toString(),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onPrimary,
            )
        }
    }
}

@Composable
private fun BoxScope.CoverBadge() {
    Text(
        text = "Cover",
        style = MaterialTheme.typography.labelSmall,
        color = MediaOverlay.BadgeInk,
        modifier = Modifier
            .align(Alignment.BottomStart)
            .padding(3.dp)
            .clip(CircleShape)
            .background(MediaOverlay.Badge)
            .padding(horizontal = 5.dp),
    )
}

@Composable
private fun BoxScope.RemoveBadge(onRemove: () -> Unit) {
    Box(
        modifier = Modifier
            .align(Alignment.TopEnd)
            .padding(3.dp)
            .size(16.dp)
            .clip(CircleShape)
            .background(MediaOverlay.Badge)
            .clickable(onClick = onRemove),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = Icons.Filled.Close,
            contentDescription = null,
            tint = MediaOverlay.BadgeInk,
            modifier = Modifier.size(10.dp),
        )
    }
}

@Composable
private fun BoxScope.DurationBadge(label: String) {
    Row(
        modifier = Modifier
            .align(Alignment.BottomStart)
            .padding(6.dp)
            .clip(RoundedCornerShape(Space.x1))
            .background(MediaOverlay.Badge)
            .padding(horizontal = 6.dp, vertical = 1.dp),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = Icons.Filled.PlayArrow,
            contentDescription = null,
            tint = MediaOverlay.BadgeInk,
            modifier = Modifier.size(10.dp),
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MediaOverlay.BadgeInk,
        )
    }
}

@ThemePreviews
@Composable
private fun MediaThumbBadges() {
    val item = MediaItem(null, 1f, "A picture")
    Cogra2PreviewTheme {
        PreviewMediaColumn {
            Row(horizontalArrangement = Arrangement.spacedBy(Space.x2)) {
                MediaThumb(item, badge = ThumbBadge.Cover)
                MediaThumb(item, badge = ThumbBadge.Remove {})
                // The crop filmstrip: the framed one wears the ring, the
                // rest fade.
                MediaThumb(item, selected = true)
                MediaThumb(item, dimmed = true)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(Space.x2)) {
                MediaThumb(item, size = 125.dp, badge = ThumbBadge.Order(1))
                MediaThumb(item, size = 125.dp, badge = ThumbBadge.Order(null))
                MediaThumb(item, size = 125.dp, badge = ThumbBadge.Duration("0:42"))
            }
        }
    }
}

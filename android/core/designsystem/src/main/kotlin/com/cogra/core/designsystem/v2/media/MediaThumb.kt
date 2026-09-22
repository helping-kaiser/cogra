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
 * The order counter and the failed dot read theme roles (`primary`,
 * `error`); [ThumbBadge.Cover], [ThumbBadge.Remove], and [ThumbBadge.Duration]
 * read `inverseSurface`/`inverseOnSurface` — the `MediaDisc` plate
 * (`design/components/compose/MediaThumb.jsx`), the one role designed to
 * stay legible over arbitrary pixels in both themes.
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
 * @param duration a clip's running time, bottom-right — a video tile
 *   carrying both [badge] (top-end or bottom-start) and a duration never
 *   collides on one corner. Drawn only where the tile reads at least
 *   [DurationBadgeMinTile]: below that floor the pill would outweigh the
 *   picture it sits on, which is the composer's summary row's own tile
 *   (`Layout.ThumbSize`, 48dp) and never the pick grid's 125dp column
 *   (jakob's ruling, 2026-09-22 — design/readme.md §13, "the
 *   composer's, and the detail has one reading"). Independently of this
 *   pill, [item]'s own `isVideo` drives the centred play disc
 *   (`MediaDisc`, `MediaThumb.jsx:86,135-153`): drawn whenever a frame is
 *   playable — [item]'s `url` resolved, not failed, not [uploading] — on
 *   every measured tile, with no floor of its own past its [20dp, 56dp]
 *   clamp.
 * @param coverSrc a clip's chosen cover, drawn as the frame itself rather
 *   than a word: an inset in the same bottom-left corner [ThumbBadge.Cover]
 *   owns, a third of the tile's short side with a 28dp floor, behind a
 *   hairline ring (`design/components/compose/MediaThumb.jsx:93,192-217`).
 *   A tile is a picture's or a clip's, so this and [badge] are never both
 *   set. Needs a resolved [width]/[height] or [size] to size itself —
 *   silently omitted on the unmeasured fill-width tile ([size] `null`).
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
    duration: String? = null,
    coverSrc: Any? = null,
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
    val geometry = thumbGeometry(width, height, size)
    // The disc draws only where a frame is playable: a real clip
    // (`item.isVideo`), a frame to show it over (`item.url != null` —
    // the sourceless neutral tile draws nothing, MediaThumb.jsx:87-90),
    // not failed, and not mid-upload — never over the ring.
    val playable = item.isVideo && item.url != null && !failed && !uploading
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
            model = item.imageModel(),
            contentDescription = null,
            contentScale = fit,
            modifier = Modifier
                .fillMaxSize()
                .alpha(if (faded) 0.65f else 1f),
        )
        if (playable && geometry.discSize != null) MediaDisc(geometry.discSize)
        if (uploading) UploadRing(progress)
        when (badge) {
            is ThumbBadge.Order -> OrderBadge(badge.position)
            ThumbBadge.Cover -> CoverBadge()
            is ThumbBadge.Remove -> RemoveBadge(badge.onRemove)
            is ThumbBadge.Duration -> if (geometry.durationFits) DurationBadge(badge.label)
            ThumbBadge.Failed -> FailedBadge()
            null -> Unit
        }
        // A clip's running time rides *beside* whatever the tile already
        // says about itself: `ComposePick` draws a video tile with the
        // selection ring at one corner and the time at another, so the
        // two are not alternatives.
        if (geometry.durationFits) duration?.let { DurationBadge(it) }
        if (coverSrc != null && geometry.coverMarkSize != null) CoverMark(coverSrc, geometry.coverMarkSize)
    }
}

/**
 * Every size-derived mark on the tile — the cover mark, the duration pill's
 * floor, and the play disc — shares this one edge computation: null on the
 * unmeasured fill-width tile, where no edge is known at composition time.
 */
private data class ThumbGeometry(val coverMarkSize: Dp?, val durationFits: Boolean, val discSize: Dp?)

/** MediaThumb.jsx:93 — the cover mark's diameter as a fraction of the tile's short edge. */
private const val COVER_MARK_EDGE_DIVISOR = 3
private val COVER_MARK_FLOOR = 28.dp

private fun thumbGeometry(width: Dp?, height: Dp?, size: Dp?): ThumbGeometry {
    val explicitW = width ?: size
    val explicitH = height ?: size
    val edge = explicitW?.let { w -> explicitH?.let { h -> minOf(w, h) } }
    return ThumbGeometry(
        // The mark scales with the tile so it reads the same on the tray's
        // 48dp chip and on a larger one, and never falls under its own
        // floor (MediaThumb.jsx:93). Null on the unmeasured fill-width
        // tile — that tile has no caller passing `coverSrc` today.
        coverMarkSize = edge?.let { maxOf(COVER_MARK_FLOOR, it / COVER_MARK_EDGE_DIVISOR) },
        // The duration pill's own floor: an unmeasured (`size = null`)
        // tile is always the pick grid's fill-width column, drawn well
        // over the floor (`PickStage`'s 125dp), so only an EXPLICIT small
        // edge hides it.
        durationFits = edge == null || edge >= DurationBadgeMinTile,
        // The play disc's own math (MediaThumb.jsx:86): 26% of the short
        // edge, clamped to [20dp, 56dp] — no floor of its own past that
        // clamp. Null on the unmeasured tile, the same precedent as the
        // cover mark: the pick grid's candidate tiles keep the duration
        // pill's own play glyph, never the centred disc (`BodyStep`'s
        // comment on that call site) — the disc is scoped to tiles whose
        // edge is actually known, the composer's single-clip preview.
        discSize = edge?.let { playDiscSize(it) },
    )
}

/**
 * The clip's chosen face, inset bottom-left — a frame rather than a word,
 * because a cover is the clip's own property and never a second attachment
 * (`design/components/compose/MediaThumb.jsx:192-217`). Radius and ring read
 * `MaterialTheme.shapes.small` (`design/tokens/shape.css:16`,
 * `--radius-small: 8px` — Dimens.kt's documented radii-read-Shapes policy)
 * and `outlineVariant`, matching the hairline the master draws.
 */
@Composable
private fun BoxScope.CoverMark(coverSrc: Any?, size: Dp) {
    val shape = MaterialTheme.shapes.small
    AsyncImage(
        model = coverSrc,
        contentDescription = null,
        contentScale = ContentScale.Crop,
        modifier = Modifier
            .align(Alignment.BottomStart)
            .padding(3.dp)
            .size(size)
            .clip(shape)
            .border(BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant), shape)
            .testTag("media_thumb_cover_mark"),
    )
}

/**
 * An upload in flight: the ring on its own scrim, centred
 * (`design/components/compose/UploadNotice.jsx`'s `Ring`, on the tile).
 *
 * The scrim is a literal [MediaOverlay] colour rather than a theme role: it
 * dims the whole tile evenly, so it is not the plate register the cover,
 * remove, and duration badges read.
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
 * The `MediaDisc` plate (`design/components/compose/MediaThumb.jsx:135-153`):
 * the centred play disc on a scrim, over the poster frame. Reads
 * `inverseSurface`/`inverseOnSurface` rather than a literal scrim, the one
 * role designed to stay legible over arbitrary pixels in both themes
 * (jakob's F8 ruling, 2026-09-17 — same register [CoverBadge], [RemoveBadge]
 * and [DurationBadge] already read).
 *
 * AUTHORING-SIDE ONLY, like the duration pill: a reading surface never
 * draws play/pause chrome (MediaThumb.jsx:31-32) — this composable has no
 * caller outside the composer today.
 */
@Composable
private fun BoxScope.MediaDisc(size: Dp) {
    Box(
        modifier = Modifier
            .align(Alignment.Center)
            .size(size)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.inverseSurface)
            .testTag("media_thumb_play_disc"),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = Icons.Filled.PlayArrow,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.inverseOnSurface,
            modifier = Modifier.size(playGlyphSize(size)).testTag("media_thumb_play_glyph"),
        )
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

/**
 * The duration pill's own floor (jakob's ruling, 2026-09-22:
 * design/readme.md §13 — "`MediaThumb` draws the pill on an authoring
 * tile of 80px or more, where an author is identifying a file among
 * files"). Under it the pill reads as the tile's whole face rather than a
 * corner mark — the composer's 48dp summary row (`PickedRow`) drew it at
 * that size until this ruling, which is what jakob's hand test caught.
 */
private val DurationBadgeMinTile = 80.dp

/** MediaThumb.jsx:86 — the disc's diameter as a fraction of the tile's short edge. */
private const val PLAY_DISC_EDGE_FRACTION = 0.26f

/** MediaThumb.jsx:151 — the play glyph's diameter as a fraction of the disc's. */
private const val PLAY_GLYPH_FRACTION = 0.57f

private val PLAY_DISC_FLOOR = 20.dp
private val PLAY_DISC_CEILING = 56.dp

/**
 * The play disc's own math (`design/components/compose/MediaThumb.jsx:86`):
 * 26% of the tile's short edge, clamped to [20dp, 56dp]. Unlike
 * [DurationBadgeMinTile], the disc has no separate floor — this clamp IS
 * its floor, so it draws at every measured size.
 */
private fun playDiscSize(edge: Dp): Dp =
    maxOf(PLAY_DISC_FLOOR, minOf(PLAY_DISC_CEILING, edge * PLAY_DISC_EDGE_FRACTION))

/** The play glyph inside the disc: 57% of its diameter (MediaThumb.jsx:151). */
private fun playGlyphSize(disc: Dp): Dp = disc * PLAY_GLYPH_FRACTION

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

/** `MediaDisc`'s plate (`design/components/compose/MediaThumb.jsx`): the
 * cover mark reads `inverseSurface`/`inverseOnSurface`, never a literal
 * scrim (jakob's F8 ruling, 2026-09-17). */
@Composable
private fun BoxScope.CoverBadge() {
    Text(
        text = "Cover",
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.inverseOnSurface,
        modifier = Modifier
            .align(Alignment.BottomStart)
            .padding(3.dp)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.inverseSurface)
            .padding(horizontal = 5.dp)
            .testTag("media_thumb_cover_badge"),
    )
}

/** Same plate as [CoverBadge] — see that function's citation. */
@Composable
private fun BoxScope.RemoveBadge(onRemove: () -> Unit) {
    Box(
        modifier = Modifier
            .align(Alignment.TopEnd)
            .padding(3.dp)
            .size(16.dp)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.inverseSurface)
            .clickable(onClick = onRemove)
            .testTag("media_thumb_remove_badge"),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = Icons.Filled.Close,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.inverseOnSurface,
            modifier = Modifier.size(10.dp),
        )
    }
}

/**
 * Same plate as [CoverBadge] — see that function's citation.
 *
 * Bottom-right, 6dp inset — its own corner and its own inset, distinct
 * from [CoverBadge]'s and [RemoveBadge]'s 3dp so the two never read as
 * one register (jakob's ruling, 2026-09-22: design/readme.md §13).
 */
@Composable
private fun BoxScope.DurationBadge(label: String) {
    Row(
        modifier = Modifier
            .align(Alignment.BottomEnd)
            .padding(6.dp)
            .clip(RoundedCornerShape(Space.x1))
            .background(MaterialTheme.colorScheme.inverseSurface)
            .padding(horizontal = 6.dp, vertical = 1.dp)
            .testTag("media_thumb_duration_badge"),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = Icons.Filled.PlayArrow,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.inverseOnSurface,
            modifier = Modifier.size(10.dp),
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.inverseOnSurface,
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
